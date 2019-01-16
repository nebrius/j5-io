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

import { IGPIOModule, IDigitalInput, IDigitalOutput } from 'core-io-types';
import { Value, Mode } from 'abstract-io';
import { getMode, setMode, getPeripheral } from '../core';
import { EventEmitter } from 'events';

const READ_UPDATE_RATE = 18;

export class GPIOManager {

  private module: IGPIOModule;
  private eventEmitter: EventEmitter;
  private intervals: NodeJS.Timeout[] = [];

  constructor(gpioModule: IGPIOModule, globalEventEmitter: EventEmitter) {
    this.module = gpioModule;
    this.eventEmitter = globalEventEmitter;
  }

  public setInputMode(pin: number, pullResistor = this.module.PULL_NONE): void {
    setMode(this.module.createDigitalInput({ pin, pullResistor }), Mode.INPUT);
  }

  public setOutputMode(pin: number): void {
    setMode(this.module.createDigitalOutput(pin), Mode.OUTPUT);
  }

  public digitalWrite(pin: number, value: Value): void {
    const peripheral = getPeripheral(pin);
    if (peripheral) {
      const currentMode = getMode(peripheral);

      // Note: if we are in input mode, digitalWrite sets the pull resistor value
      // instead of changing to output mode and writing the value.
      if (currentMode === Mode.INPUT) {
        const newPullResistor = value ? this.module.PULL_UP : this.module.PULL_DOWN;
        if ((peripheral as IDigitalInput).pullResistor !== newPullResistor) {
          this.setInputMode(pin, newPullResistor);
        }
        return;
      } else if (currentMode !== Mode.OUTPUT) {
        this.setOutputMode(pin);
      }
    }

    // Need to refetch the peripheral in case it was reinstantiated in the above logic
    (getPeripheral(pin) as IDigitalOutput).write(value);
  }

  public digitalRead(pin: number, handler: (value: Value) => void): void {
    const peripheral = getPeripheral(pin);
    if (!peripheral || getMode(peripheral) !== Mode.INPUT) {
      this.setInputMode(pin);
    }

    let previousValue = -1;
    const interval = setInterval(() => {
      const currentPeripheral = getPeripheral(pin);
      if (!currentPeripheral) {
        clearInterval(interval);
        return;
      }
      switch (getMode(currentPeripheral)) {
        // Note: although we can only initiate this method in INPUT mode, we are supposed to continue
        // reporting values even if it's changed to OUTPUT mode
        case Mode.INPUT:
        case Mode.OUTPUT:
          const value = (currentPeripheral as IDigitalInput).value;
          if (value !== previousValue) {
            previousValue = value;
            this.eventEmitter.emit(`digital-read-${pin}`, value);
            handler(value);
          }
          break;
        default:
          clearInterval(interval);
      }
    }, READ_UPDATE_RATE);
    this.intervals.push(interval);
  }
}
