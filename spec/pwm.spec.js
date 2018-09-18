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

/*global it describe expect*/

// Enable test mode for all modules that use this environment variable
process.env['RASPI-TEST-MODE'] = true;

const { RaspiIOCore } = require('../dist/index');
const {
  raspiMock,
  raspiBoardMock,
  raspiGpioMock,
  raspiI2CMock,
  raspiLEDMock,
  raspiPWMMock,
  raspiSerialMock
} = require('./mocks');

describe('PWM', () => {

  const pinAlias = 'GPIO18';

  function createInstance(cb) {
    const raspi = new RaspiIOCore({
      enableSerial: true,
      platform: {
        'raspi': raspiMock,
        'raspi-board': raspiBoardMock,
        'raspi-gpio': raspiGpioMock,
        'raspi-i2c': raspiI2CMock,
        'raspi-led': raspiLEDMock,
        'raspi-pwm': raspiPWMMock,
        'raspi-serial': raspiSerialMock
      }
    });
    raspi.on('ready', () => cb(raspi));
  }

  it('can set a pin in PWM mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.PWM);
    expect(raspi.pins[pin].mode).toEqual(3);

    const { peripheral } = raspi.getInternalPinInstances()[pin];
    expect(peripheral.args.length).toEqual(1);
    expect(peripheral.args[0]).toEqual(pin);
    done();
  }));

  it('can set a pin in SERVO mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.SERVO);
    expect(raspi.pins[pin].mode).toEqual(4);

    const { peripheral } = raspi.getInternalPinInstances()[pin];
    expect(peripheral.args.length).toEqual(1);
    expect(peripheral.args[0]).toEqual(pin);
    done();
  }));

  it('can set the duty cycle via `pwmWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.PWM);
    const { peripheral } = raspi.getInternalPinInstances()[pin];

    raspi.pwmWrite(pinAlias, 0);
    expect(peripheral.dutyCycle).toEqual(0);

    raspi.pwmWrite(pinAlias, 64);
    expect(peripheral.dutyCycle).toEqual(64 / 255);

    raspi.pwmWrite(pinAlias, 128);
    expect(peripheral.dutyCycle).toEqual(128 / 255);

    raspi.pwmWrite(pinAlias, 255);
    expect(peripheral.dutyCycle).toEqual(1);

    done();
  }));

  it('can set the duty cycle via `analogWrite`', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.PWM);
    const { peripheral } = raspi.getInternalPinInstances()[pin];

    raspi.analogWrite(pinAlias, 0);
    expect(peripheral.dutyCycle).toEqual(0);

    raspi.analogWrite(pinAlias, 64);
    expect(peripheral.dutyCycle).toEqual(64 / 255);

    raspi.analogWrite(pinAlias, 128);
    expect(peripheral.dutyCycle).toEqual(128 / 255);

    raspi.analogWrite(pinAlias, 255);
    expect(peripheral.dutyCycle).toEqual(1);

    done();
  }));

  // servoWrite
  // servoConfig
});
