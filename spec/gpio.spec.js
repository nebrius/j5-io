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

describe('App Initialization', () => {

  const pinAlias = 'GPIO10';

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

  it('can set a pin in input mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const { peripheral } = raspi.getInternalPinInstances()[pin];
    expect(raspi.pins[pin].mode).toEqual(0);
    expect(peripheral.args.length).toEqual(1);
    expect(peripheral.args[0]).toEqual({
      pin,
      pullResistor: 0
    });
    done();
  }));

  it('can read from a pin using the `value` property', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const { peripheral } = raspi.getInternalPinInstances()[pin];

    peripheral.setMockedValue(0);
    expect(raspi.pins[pin].value).toEqual(0);
    peripheral.setMockedValue(1);
    expect(raspi.pins[pin].value).toEqual(1);

    done();
  }));

  it('can read from a pin using the `digitalRead` method', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const { peripheral } = raspi.getInternalPinInstances()[pin];

    let value = 0;
    peripheral.setMockedValue(value);
    raspi.digitalRead(pinAlias, (newValue) => {
      expect(value).toEqual(newValue);
      if (value === 0) {
        value = 1;
        peripheral.setMockedValue(value);
      } else {
        done();
      }
    });
  }));
});
