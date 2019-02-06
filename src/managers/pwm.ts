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

import { IPWMModule, IPWM } from 'core-io-types';
import { Mode } from 'abstract-io';
import { getMode, setMode, getPeripheral, constrain } from '../core';

const DEFAULT_SERVO_MIN = 1000;
const DEFAULT_SERVO_MAX = 2000;

export class PWMManager {

  private module: IPWMModule;
  private ranges: { [ pin: number ]: { min: number, max: number } } = {};

  constructor(pwmModule: IPWMModule) {
    this.module = pwmModule;
  }

  public setServoMode(pin: number, frequency?: number, range?: number): void {
    if (!this.ranges[pin]) {
      this.ranges[pin] = { min: DEFAULT_SERVO_MIN, max: DEFAULT_SERVO_MAX };
    }
    setMode(this.module.createPWM(pin), Mode.SERVO);
  }

  public setPWMMode(pin: number): void {
    setMode(this.module.createPWM(pin), Mode.PWM);
  }

  public pwmWrite(pin: number, dutyCycle: number): void {
    const peripheral = getPeripheral(pin);
    if (!peripheral || getMode(peripheral) !== Mode.PWM) {
      this.setPWMMode(pin);
    }
    // Need to refetch the peripheral in case it was reinstantiated in the above logic
    (getPeripheral(pin) as IPWM).write(constrain(dutyCycle, 0, 255) / 255);
  }

  public servoConfig(pin: number, min?: number, max?: number): void {
    if (typeof min !== 'number') {
      min = DEFAULT_SERVO_MIN;
    }
    if (typeof max !== 'number') {
      max = DEFAULT_SERVO_MAX;
    }
    const peripheral = getPeripheral(pin);
    if (!peripheral || getMode(peripheral) !== Mode.SERVO) {
      this.setServoMode(pin);
    }
    this.ranges[pin] = { min, max };
  }

  public servoWrite(pin: number, value: number): void {
    let peripheral = getPeripheral(pin);
    if (!peripheral || getMode(peripheral) !== Mode.SERVO) {
      this.setServoMode(pin);
    }

    // Need to refetch the peripheral in case it was reinstantiated in the above logic
    peripheral = getPeripheral(pin) as IPWM;

    const period = 1000000 / (peripheral as IPWM).frequency; // in us
    const { min, max } = this.ranges[pin];
    let pulseWidth;
    if (value < 544) {
      pulseWidth = min + constrain(value, 0, 180) / 180 * (max - min);
    } else {
      pulseWidth = constrain(value, min, max);
    }
    (peripheral as IPWM).write(pulseWidth / period);
  }

}
