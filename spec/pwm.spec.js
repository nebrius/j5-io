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

/*global it xdescribe expect*/

const { createInstance } = require('./mocks');

const VALUE_TOLERANCE = 0.001;

function expectToRoughlyEqual(value, expectedValue) {
  expect(value).toBeLessThan(expectedValue + VALUE_TOLERANCE);
  expect(value).toBeGreaterThan(expectedValue - VALUE_TOLERANCE);
}

xdescribe('PWM', () => {

  const pinAlias = 'GPIO18';

  it('can set a pin in PWM mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.PWM);
    expect(raspi.pins[pin].mode).toEqual(3);

    const peripheral = raspi.getInternalPinInstances()[pin];
    expect(peripheral.args.length).toEqual(1);
    expect(peripheral.args[0]).toEqual(pin);
    done();
  }));

  it('can set a pin in SERVO mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    expect(raspi.pins[pin].mode).toEqual(4);

    const peripheral = raspi.getInternalPinInstances()[pin];
    expect(peripheral.args.length).toEqual(1);
    expect(peripheral.args[0]).toEqual(pin);
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
    const peripheral = raspi.getInternalPinInstances()[pin];

    raspi.pwmWrite(pinAlias, 0);
    expectToRoughlyEqual(peripheral.dutyCycle, 0);

    raspi.pwmWrite(pinAlias, 64);
    expectToRoughlyEqual(peripheral.dutyCycle, 64 / 255);

    raspi.pwmWrite(pinAlias, 128);
    expectToRoughlyEqual(peripheral.dutyCycle, 128 / 255);

    raspi.pwmWrite(pinAlias, 255);
    expectToRoughlyEqual(peripheral.dutyCycle, 1);

    done();
  }));

  it('can set the duty cycle via `analogWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.PWM);
    const peripheral = raspi.getInternalPinInstances()[pin];

    raspi.analogWrite(pinAlias, 0);
    expectToRoughlyEqual(peripheral.dutyCycle, 0);

    raspi.analogWrite(pinAlias, 64);
    expectToRoughlyEqual(peripheral.dutyCycle, 64 / 255);

    raspi.analogWrite(pinAlias, 128);
    expectToRoughlyEqual(peripheral.dutyCycle, 128 / 255);

    raspi.analogWrite(pinAlias, 255);
    expectToRoughlyEqual(peripheral.dutyCycle, 1);

    done();
  }));

  it('can set the duty cycle in degrees via `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = raspi.getInternalPinInstances()[pin];

    raspi.servoWrite(pinAlias, 0);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.001 * peripheral.frequency);

    raspi.servoWrite(pinAlias, 90);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.0015 * peripheral.frequency);

    raspi.servoWrite(pinAlias, 180);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.002 * peripheral.frequency);

    done();
  }));

  it('can set the duty cycle in degrees over 180 that get constrained to 180 via `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = raspi.getInternalPinInstances()[pin];

    raspi.servoWrite(pinAlias, 190);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.002 * peripheral.frequency);

    raspi.servoWrite(pinAlias, 300);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.002 * peripheral.frequency);

    raspi.servoWrite(pinAlias, 543);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.002 * peripheral.frequency);

    done();
  }));

  it('can set the duty cycle in nanoseconds over 543 via `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = raspi.getInternalPinInstances()[pin];

    raspi.servoWrite(pinAlias, 1000);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.001 * peripheral.frequency);

    raspi.servoWrite(pinAlias, 1500);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.0015 * peripheral.frequency);

    raspi.servoWrite(pinAlias, 2000);
    expectToRoughlyEqual(peripheral.dutyCycle, 0.002 * peripheral.frequency);

    done();
  }));

  it('can set the duty cycle in nanoseconds that are constrained to min and max via `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const { peripheral, min, max } = raspi.getInternalPinInstances()[pin];

    raspi.servoWrite(pinAlias, 544);
    expectToRoughlyEqual(peripheral.dutyCycle, (min / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 2500);
    expectToRoughlyEqual(peripheral.dutyCycle, (max / 1000000) * peripheral.frequency);

    done();
  }));

  it('can configure the servo for different min and max via `servoConfig` when sending degrees to `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = raspi.getInternalPinInstances()[pin];
    const min = 700;
    const max = 2400;

    raspi.servoConfig(pinAlias, min, max);

    raspi.servoWrite(pinAlias, 0);
    expectToRoughlyEqual(peripheral.dutyCycle, (min / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 90);
    expectToRoughlyEqual(peripheral.dutyCycle, (((max - min) / 2 + min) / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 180);
    expectToRoughlyEqual(peripheral.dutyCycle, (max / 1000000) * peripheral.frequency);

    done();
  }));

  it('can configure the servo for defaul min and max via `servoConfig` when sending degrees to `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    const min = 1000;
    const max = 2000;

    raspi.servoConfig(pinAlias);
    const peripheral = raspi.getInternalPinInstances()[pin];

    raspi.servoWrite(pinAlias, 0);
    expectToRoughlyEqual(peripheral.dutyCycle, (min / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 90);
    expectToRoughlyEqual(peripheral.dutyCycle, (((max - min) / 2 + min) / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 180);
    expectToRoughlyEqual(peripheral.dutyCycle, (max / 1000000) * peripheral.frequency);

    done();
  }));

  it('can configure the servo for different min and max via `servoConfig` when sending degrees to `servoWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    const peripheral = raspi.getInternalPinInstances()[pin];
    const min = 700;
    const max = 2400;

    raspi.servoConfig(pinAlias, min, max);

    raspi.servoWrite(pinAlias, 600);
    expectToRoughlyEqual(peripheral.dutyCycle, (min / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 800);
    expectToRoughlyEqual(peripheral.dutyCycle, (800 / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 1800);
    expectToRoughlyEqual(peripheral.dutyCycle, (1800 / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 2200);
    expectToRoughlyEqual(peripheral.dutyCycle, (2200 / 1000000) * peripheral.frequency);

    raspi.servoWrite(pinAlias, 2800);
    expectToRoughlyEqual(peripheral.dutyCycle, (max / 1000000) * peripheral.frequency);

    done();
  }));
});
