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
import { getMode, setMode } from '../core';

export class GPIOManager {

  private module: IGPIOModule;
  private inputInstances: IDigitalInput[] = [];
  private outputInstances: IDigitalOutput[] = [];

  constructor(gpioModule: IGPIOModule) {
    this.module = gpioModule;
  }

  public digitalWrite(pin: number, value: Value): void {
    if (getMode(pin) === Mode.INPUT) {
      this.inputInstances[pin] = this.module.createDigitalInput({
        pin,
        pullResistor: value
      });
      this.inputInstances[pin].on('destroyed', () => delete this.inputInstances[pin]);
    } else if (getMode(pin) != Mode.OUTPUT) {
      setMode(pin, Mode.OUTPUT);
      // So what about the LED module?
      this.outputInstances[pin] = this.module.createDigitalOutput(pin);
      this.outputInstances[pin].on('destroyed', () => delete this.inputInstances[pin]);
    }
    if (getMode(pin) === Mode.OUTPUT) {
      this.outputInstances[pin].write(value);
    }
  }

  public digitalRead(pin: string | number, handler: (value: Value) => void): void {
  }
}
