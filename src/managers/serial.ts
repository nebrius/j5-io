/*
Copyright (c) Bryan Hughes <bryan@nebri.us>

Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the 'Software'), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/

import { ISerialModule, ISerial } from 'core-io-types';
import { ISerialConfig, Handler, Mode } from 'abstract-io';
import { createInternalErrorMessage, setMode } from '../core';
import { EventEmitter } from 'events';

// TODO: add unit tests for multiple simultaneous serial ports

const DEFAULT_BAUD_RATE = 9600;

enum Action {
  Write,
  Close,
  Flush,
  Config,
  Read,
  Stop
}

interface IQueueItem {
  type: Action;
}

interface IQueueWriteItem extends IQueueItem {
  inBytes: number[];
}

interface IQueueReadItem extends IQueueItem {
  maxBytesToRead?: number;
  handler: (data: number[]) => void;
}

interface IQueueConfigItem extends IQueueItem {
  baud: number;
}

class SerialPortManager {

  public isOpen: boolean = false;

  public get baudrate() {
    return this.serial.baudRate;
  }

  private serial: ISerial;
  private actionQueue: IQueueItem[] = [];
  private isSerialProcessing = false;
  private portId: string | number;
  private module: ISerialModule;
  private eventEmitter: EventEmitter;

  constructor(portId: string | number, serialModule: ISerialModule, globalEventEmitter: EventEmitter) {
    this.portId = portId;
    this.module = serialModule;
    this.eventEmitter = globalEventEmitter;
    this.serial = serialModule.createSerial({ portId: this.portId.toString() });
    setMode(this.serial, Mode.UNKOWN);
  }

  public reset() {
    this.serial.removeAllListeners();
    this.serial.close();
    this.actionQueue = [];
    this.isSerialProcessing = false;
  }

  public addToSerialQueue(action: IQueueItem): void {
    this.actionQueue.push(action);
    this.serialPump();
  }

  private serialPump(): void {
    if (this.isSerialProcessing) {
      return;
    }
    const action = this.actionQueue.shift();
    if (!action) {
      return;
    }
    this.isSerialProcessing = true;
    const finalize = () => {
      this.isSerialProcessing = false;
      this.serialPump();
    };
    switch (action.type) {
      case Action.Write:
        if (!this.isOpen) {
          throw new Error('Cannot write to closed serial port');
        }
        this.serial.write(Buffer.from((action as IQueueWriteItem).inBytes), finalize);
        break;

      case Action.Read:
        if (!this.isOpen) {
          throw new Error('Cannot read from closed serial port');
        }
        // TODO: add support for action.maxBytesToRead
        this.serial.on('data', (data: Buffer) => {
          (action as IQueueReadItem).handler(Array.from(data.values()));
        });
        process.nextTick(finalize);
        break;

      case Action.Stop:
        if (!this.isOpen) {
          throw new Error('Cannot stop closed serial port');
        }
        this.serial.removeAllListeners();
        process.nextTick(finalize);
        break;

      case Action.Config:
        this.serial.close(() => {
          this.serial = this.module.createSerial({
            baudRate: (action as IQueueConfigItem).baud
          });
          setMode(this.serial, Mode.UNKOWN);
          if (process.env.RASPI_IO_TEST_MODE) {
            this.eventEmitter.emit('$TEST_MODE-serial-instance-created', this.serial);
          }
          this.serial.open(() => {
            this.serial.on('data', (data) => {
              this.eventEmitter.emit(`serial-data-${this.portId}`, Array.from(data.values()));
            });
            this.isOpen = true;
            finalize();
          });
        });
        break;

      case Action.Close:
        this.serial.close(() => {
          this.isOpen = false;
          finalize();
        });
        break;

      case Action.Flush:
        if (!this.isOpen) {
          throw new Error('Cannot flush closed serial port');
        }
        this.serial.flush(finalize);
        break;

      default:
        throw new Error('Internal error: unknown serial action type');
    }
  }

}

export class SerialManager {

  private module: ISerialModule;
  private serialPortManagers: { [ portId: string ]: SerialPortManager } = {};
  private eventEmitter: EventEmitter;
  private serialIds: { [ id: string ]: any };

  constructor(serialModule: ISerialModule, serialIds: { [ id: string ]: any }, globalEventEmitter: EventEmitter) {
    this.module = serialModule;
    this.eventEmitter = globalEventEmitter;
    this.serialIds = serialIds;
  }

  public reset() {
    for (const portId in this.serialPortManagers) {
      if (!this.serialPortManagers.hasOwnProperty(portId)) {
        continue;
      }
      this.serialPortManagers[portId].reset();
    }
    this.serialPortManagers = {};
  }

  public serialConfig({ portId, baud, rxPin, txPin }: ISerialConfig): void {
    if (!portId) {
      throw new Error('"portId" parameter missing in options');
    }
    if (typeof rxPin !== 'undefined' || typeof txPin !== 'undefined') {
      throw new Error('"txPin" and "rxPin" are not supported in "serialConfig"');
    }
    this.ensureManager(portId);
    if (!this.serialPortManagers[portId].isOpen || (baud && baud !== this.serialPortManagers[portId].baudrate)) {
      const action: IQueueConfigItem = {
        type: Action.Config,
        baud: typeof baud === 'number' ? baud : DEFAULT_BAUD_RATE
      };
      this.serialPortManagers[portId].addToSerialQueue(action);
    }
  }

  public serialWrite(portId: string | number, inBytes: number[]): void {
    if (!portId) {
      throw new Error('"portId" argument missing');
    }
    this.ensureManager(portId);
    const queueItem: IQueueWriteItem = {
      type: Action.Write,
      inBytes
    };
    this.serialPortManagers[portId].addToSerialQueue(queueItem);
  }

  public serialRead(
    portId: number | string,
    maxBytesToReadOrHandler: Handler<number[]> | number,
    handlerOrUndefined?: Handler<number[]>
  ): void {
    if (!portId) {
      throw new Error('"portId" argument missing');
    }
    this.ensureManager(portId);
    let handler: Handler<number[]>;
    let maxBytesToRead: number | undefined;
    if (typeof maxBytesToReadOrHandler === 'function') {
      handler = maxBytesToReadOrHandler;
      maxBytesToRead = undefined;
    } else if (typeof handlerOrUndefined === 'function') {
      handler = handlerOrUndefined;
      maxBytesToRead = maxBytesToReadOrHandler;
    } else {
      throw new Error(createInternalErrorMessage('could not swizzle arguments'));
    }
    const action: IQueueReadItem = {
      type: Action.Read,
      maxBytesToRead,
      handler
    };
    this.serialPortManagers[portId].addToSerialQueue(action);
  }

  public serialStop(portId: number | string): void {
    if (!portId) {
      throw new Error('"portId" argument missing');
    }
    this.ensureManager(portId);
    const action: IQueueItem = {
      type: Action.Stop
    };
    this.serialPortManagers[portId].addToSerialQueue(action);
  }

  public serialClose(portId: number | string): void {
    if (!portId) {
      throw new Error('"portId" argument missing');
    }
    this.ensureManager(portId);
    const action: IQueueItem = {
      type: Action.Close
    };
    this.serialPortManagers[portId].addToSerialQueue(action);
  }

  public serialFlush(portId: number | string): void {
    if (!portId) {
      throw new Error('"portId" argument missing');
    }
    this.ensureManager(portId);
    const action: IQueueItem = {
      type: Action.Flush
    };
    this.serialPortManagers[portId].addToSerialQueue(action);
  }

  private ensureManager(portId: string | number): void {
    let portIdIsValid = false;
    for (const serialId in this.serialIds) {
      if (portId === this.serialIds[serialId]) {
        portIdIsValid = true;
        break;
      }
    }
    if (!portIdIsValid) {
      throw new Error(`Invalid serial port "${portId}"`);
    }
    if (!this.serialPortManagers[portId]) {
      this.serialPortManagers[portId] = new SerialPortManager(portId, this.module, this.eventEmitter);
    }
  }

}
