/*
Copyright (c) 2014-2018 Bryan Hughes <bryan@nebri.us>

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

import { createInstance, Peripheral, PWM } from './mocks';

const VALUE_TOLERANCE = 0.001;

const DEFAULT_SERVO_MIN = 1000;
const DEFAULT_SERVO_MAX = 2000;

function expectToRoughlyEqual(value: number, expectedValue: number): void {
  expect(value).toBeLessThan(expectedValue + VALUE_TOLERANCE);
  expect(value).toBeGreaterThan(expectedValue - VALUE_TOLERANCE);
}

type GetPinInstances = () => { [pin: number]: Peripheral };

describe('PWM', () => {

  const pinAlias = 'GPIO18';

  it('can set a pin in PWM mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.PWM);
    expect(raspi.pins[pin].mode).toEqual(3);

    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];
    expect((peripheral as PWM).args.length).toEqual(1);
    expect((peripheral as PWM).args[0]).toEqual(pin);
    done();
  }));

  it('can set a pin in SERVO mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    expect(raspi.pins[pin].mode).toEqual(4);

    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];
    expect((peripheral as PWM).args.length).toEqual(1);
    expect((peripheral as PWM).args[0]).toEqual(pin);
    done();
  }));

  it('can set a pin in PWM mode by calling `pwmWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pwmWrite(pin, 0);
    expect(raspi.pins[pin].mode).toEqual(3);
    done();
  }));

  it('can set a pin in PWM mode by calling `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.servoWrite(pin, 0);
    expect(raspi.pins[pin].mode).toEqual(4);
    done();
  }));

  it('can set the duty cycle via `pwmWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.PWM);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];

    raspi.pwmWrite(pinAlias, 0);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0);

    raspi.pwmWrite(pinAlias, 64);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 64 / 255);

    raspi.pwmWrite(pinAlias, 128);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 128 / 255);

    raspi.pwmWrite(pinAlias, 255);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 1);

    done();
  }));

  it('can set the duty cycle via `analogWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.PWM);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];

    raspi.analogWrite(pinAlias, 0);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0);

    raspi.analogWrite(pinAlias, 64);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 64 / 255);

    raspi.analogWrite(pinAlias, 128);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 128 / 255);

    raspi.analogWrite(pinAlias, 255);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 1);

    done();
  }));

  it('can set the duty cycle in degrees via `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];

    raspi.servoWrite(pinAlias, 0);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.001 * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 90);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.0015 * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 180);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.002 * (peripheral as PWM).frequency);

    done();
  }));

  it('constrains to 180 degrees via `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];

    raspi.servoWrite(pinAlias, 190);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.002 * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 300);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.002 * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 543);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.002 * (peripheral as PWM).frequency);

    done();
  }));

  it('can set the duty cycle in nanoseconds over 543 via `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];

    raspi.servoWrite(pinAlias, 1000);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.001 * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 1500);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.0015 * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 2000);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, 0.002 * (peripheral as PWM).frequency);

    done();
  }));

  it('can set the duty cycle in ns constrained to min and max via `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];

    raspi.servoWrite(pinAlias, 544);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (DEFAULT_SERVO_MIN / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 2500);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (DEFAULT_SERVO_MAX / 1000000) * (peripheral as PWM).frequency);

    done();
  }));

  it('can configure the servo for different min and max via `servoConfig` when sending degrees to `servoWrite`',
  (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const min = 700;
    const max = 2400;

    raspi.servoConfig(pinAlias, min, max);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];

    raspi.servoWrite(pinAlias, 0);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (min / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 90);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle,
      (((max - min) / 2 + min) / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 180);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (max / 1000000) * (peripheral as PWM).frequency);

    done();
  }));

  it('can configure the servo for default min and max via when sending degrees to `servoWrite`',
  (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    const min = 1000;
    const max = 2000;

    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];

    raspi.servoWrite(pinAlias, 0);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (min / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 90);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle,
      (((max - min) / 2 + min) / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 180);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (max / 1000000) * (peripheral as PWM).frequency);

    done();
  }));

  it('can configure the servo for different min and max via `servoConfig` when sending degrees to `servoWrite`',
  (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];
    const min = 700;
    const max = 2400;

    raspi.servoConfig(pinAlias, min, max);

    raspi.servoWrite(pinAlias, 600);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (min / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 800);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (800 / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 1800);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (1800 / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 2200);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (2200 / 1000000) * (peripheral as PWM).frequency);

    raspi.servoWrite(pinAlias, 2800);
    expectToRoughlyEqual((peripheral as PWM).dutyCycle, (max / 1000000) * (peripheral as PWM).frequency);

    done();
  }));
});
