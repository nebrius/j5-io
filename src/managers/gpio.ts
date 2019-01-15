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
import { getMode, setMode, getPeripheral, createInternalErrorMessage } from '../core';
import { EventEmitter } from 'events';

export class GPIOManager {

  private module: IGPIOModule;
  private eventEmitter: EventEmitter;

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

    // Use an arrow function so we can bind "this" properly
    const addListener = () => {
      const currentPeripheral = getPeripheral(pin);
      if (!currentPeripheral) {
        throw new Error(createInternalErrorMessage(`peripheral is undefined even after setting the input mode`));
      }

      switch (getMode(currentPeripheral)) {
        // Note: although we can only initiate this method in INPUT mode, we are supposed to continue
        // reporting values even if it's changed to OUTPUT mode
        case Mode.INPUT:
        case Mode.OUTPUT:
          currentPeripheral.on('change', (value) => {
            this.eventEmitter.emit(`digital-read-${pin}`, value);
            handler(value);
          });

          // Note: the peripheral instance will change if the pull resistor is changed or the mode is set to OUTPUT
          // In both of these cases, we still want to emit digital-read-${pin} events
          currentPeripheral.on('destroyed', () => setImmediate(addListener));
          break;
        default:
          // Ignore all other modes, as the spec only calls for listening to input and output modes
      }
    };
    addListener();

    // Force an initial "read" so that J5 knows the initial state of the pin
    setImmediate(() => {
      if (!peripheral) {
        throw new Error(createInternalErrorMessage(`peripheral is undefined even after setting the input mode`));
      }
      const value = (peripheral as IDigitalInput).value;
      this.eventEmitter.emit(`digital-read-${pin}`, value);
      handler(value);
    });
  }
}
