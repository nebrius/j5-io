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

import { II2CModule, II2C } from 'j5-io-types';
import { Handler, Mode } from 'abstract-io';
import { EventEmitter } from 'events';
import { setMode } from '../core';

enum Action {
  Read,
  Write
}

interface IQueueItem {
  type: Action;
}

interface IQueueReadItem extends IQueueItem {
  continuous: boolean;
  address: number;
  register: number | undefined;
  bytesToRead: number;
  handler: Handler<number[]>;
}

interface IQueueWriteItem extends IQueueItem {
  address: number;
  register: number | undefined;
  payload: number[] | number;
}

class I2CPortManager {

  public i2c: II2C;

  private actionQueue: IQueueItem[] = [];
  private eventEmitter: EventEmitter;
  private isI2CProcessing = false;

  constructor(portId: string | number, i2cModule: II2CModule, globalEventEmitter: EventEmitter) {
    this.i2c = i2cModule.createI2C(portId);
    setMode(this.i2c, Mode.UNKNOWN);
    this.eventEmitter = globalEventEmitter;
  }

  public reset() {
    this.isI2CProcessing = false;
    this.actionQueue = [];
  }

  public addToQueue(action: IQueueItem): void {
    this.actionQueue.push(action);
    this.i2cPump();
  }

  private i2cPump(): void {
    if (this.isI2CProcessing || !this.i2c.alive) {
      return;
    }
    const action = this.actionQueue.shift();
    if (!action) {
      return;
    }
    this.isI2CProcessing = true;
    const finalize = () => {
      this.isI2CProcessing = false;
      this.i2cPump();
    };
    switch (action.type) {

      case Action.Write:
        const { address: writeAddress, register: writeRegister, payload } = (action as IQueueWriteItem);
        if (Array.isArray(payload)) {
          if (typeof writeRegister === 'number') {
            this.i2c.write(writeAddress, writeRegister, Buffer.from(payload), finalize);
          } else {
            this.i2c.write(writeAddress, Buffer.from(payload), finalize);
          }
        } else {
          if (typeof writeRegister === 'number') {
            this.i2c.writeByte(writeAddress, writeRegister, payload, finalize);
          } else {
            this.i2c.writeByte(writeAddress, payload, finalize);
          }
        }
        break;

      case Action.Read:
        const {
          continuous,
          address: readAddress,
          register: readRegister,
          bytesToRead,
          handler
        } = (action as IQueueReadItem);

        const readCB = (err: Error | string | null, buffer: null | Buffer) => {
          if (err || !buffer) {
            this.eventEmitter.emit('error', err);
            return;
          }

          const arr = Array.from(buffer.values());
          const eventName = `i2c-reply-${readAddress}-${typeof readRegister === 'number' ? readRegister : 0}`;
          this.eventEmitter.emit(eventName, arr);
          handler(arr);

          if (continuous) {
            setImmediate(() => {
              const continuousAction: IQueueReadItem = {
                type: Action.Read,
                continuous,
                address: readAddress,
                register: readRegister,
                bytesToRead,
                handler
              };
              this.addToQueue(continuousAction);
            });
          }

          finalize();
        };

        if (typeof readRegister === 'number') {
          this.i2c.read(readAddress, readRegister, bytesToRead, readCB);
        } else {
          this.i2c.read(readAddress, bytesToRead, readCB);
        }
        break;

      default:
        throw new Error('Internal error: unknown serial action type');
    }
  }
}

export class I2CManager {
  private i2cPortManagers: { [ portId: string ]: I2CPortManager } = {};

  constructor(i2cModule: II2CModule, i2cIds: { [ id: string ]: any }, globalEventEmitter: EventEmitter) {
    for (const portIdAlias in i2cIds) {
      if (!i2cIds.hasOwnProperty(portIdAlias)) {
        continue;
      }
      const portId = i2cIds[portIdAlias];
      this.i2cPortManagers[portId] = new I2CPortManager(portId, i2cModule, globalEventEmitter);
    }
  }

  public getI2CInstance(portId: string | number): II2C {
    if (!portId) {
      throw new Error('"portId" argument missing');
    }
    if (!this.i2cPortManagers[portId]) {
      throw new Error(`No I2C Port Manager for port ${portId}`);
    }
    return this.i2cPortManagers[portId].i2c;
  }

  public reset() {
    for (const portId in this.i2cPortManagers) {
      if (!this.i2cPortManagers.hasOwnProperty(portId)) {
        continue;
      }
      this.i2cPortManagers[portId].reset();
    }
    this.i2cPortManagers = {};
  }

  public i2cWrite(
    portId: string | number,
    address: number,
    register: number | undefined,
    payload: number[] | number
  ): void {
    if (!this.i2cPortManagers.hasOwnProperty(portId)) {
      throw new Error(`Invalid I2C port ID ${portId}`);
    }
    const action: IQueueWriteItem = {
      type: Action.Write,
      address,
      register,
      payload
    };
    this.i2cPortManagers[portId].addToQueue(action);
  }

  public i2cRead(
    portId: string | number,
    continuous: boolean,
    address: number,
    register: number | undefined,
    bytesToRead: number,
    handler: Handler<number[]>
  ): void {
    if (!this.i2cPortManagers.hasOwnProperty(portId)) {
      throw new Error(`Invalid I2C port ID ${portId}`);
    }
    const action: IQueueReadItem = {
      type: Action.Read,
      continuous,
      address,
      register,
      bytesToRead,
      handler
    };
    this.i2cPortManagers[portId].addToQueue(action);
  }
}
