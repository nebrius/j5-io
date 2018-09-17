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

// This is used to control how many times we want to successively read using the `digitalRead` method
const NUM_DIGITAL_READS = 10;

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

  // Input tests

  it('can set a pin in input mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    expect(raspi.pins[pin].mode).toEqual(0);

    const { peripheral } = raspi.getInternalPinInstances()[pin];
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

    let numReadsRemaining = NUM_DIGITAL_READS;
    let value = 0;
    peripheral.setMockedValue(value);
    raspi.digitalRead(pinAlias, (newValue) => {
      expect(value).toEqual(newValue);
      if (!(--numReadsRemaining)) {
        done();
        return;
      }
      value = value === 1 ? 0 : 1;
      peripheral.setMockedValue(value);
    });
  }));

  it('can read from a pin using the `digital-read-${pin}` event', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const { peripheral } = raspi.getInternalPinInstances()[pin];

    let numReadsRemaining = NUM_DIGITAL_READS;
    let value = 0;
    peripheral.setMockedValue(value);
    raspi.digitalRead(pinAlias);

    // TODO: follow up on https://github.com/rwaldron/io-plugins/issues/16 to see if we need to rename this event
    raspi.on(`digital-read-${pinAlias}`, (newValue) => {
      expect(value).toEqual(newValue);
      if (!(--numReadsRemaining)) {
        done();
        return;
      }
      value = value === 1 ? 0 : 1;
      peripheral.setMockedValue(value);
    });
  }));

  it('can read from a pin using the `digitalRead` method at no more than 200Hz and no less than 50Hz', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const { peripheral } = raspi.getInternalPinInstances()[pin];

    let numReadsRemaining = NUM_DIGITAL_READS;
    let lastReadTimestamp = -1;
    let value = 0;

    raspi.digitalRead(pinAlias, () => {
      if (lastReadTimestamp !== -1) {
        const duration = Date.now() - lastReadTimestamp;
        expect(duration).toBeGreaterThanOrEqual(5); // Less than or equal to 200Hz
        expect(duration).toBeLessThanOrEqual(20); // Greater than or equal to 50Hz
      }
      lastReadTimestamp = Date.now();
      value = value === 1 ? 0 : 1;
      peripheral.setMockedValue(value);
      if (!(--numReadsRemaining)) {
        done();
        return;
      }
    });
  }));

  // Output tests

  it('can set a pin in output mode after putting it in input mode', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);

    // Note: OUTPUT mode is default, so we force it to input mode first to make sure we can change it back to OUTPUT mode
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    expect(raspi.pins[pin].mode).toEqual(0);
    raspi.pinMode(pinAlias, raspi.MODES.OUTPUT);
    expect(raspi.pins[pin].mode).toEqual(1);

    const { peripheral } = raspi.getInternalPinInstances()[pin];
    expect(peripheral.args.length).toEqual(1);
    expect(peripheral.args[0]).toEqual({
      pin,
      pullResistor: 0
    });
    done();
  }));

  it('can write a value to a pin using the `digitalWrite` method', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);

    const { peripheral } = raspi.getInternalPinInstances()[pin];
    raspi.digitalWrite(pinAlias, 0);
    expect(peripheral.value).toEqual(0);
    expect(raspi.pins[pin].value).toEqual(0);
    raspi.digitalWrite(pinAlias, 1);
    expect(peripheral.value).toEqual(1);
    expect(raspi.pins[pin].value).toEqual(1);
    done();
  }));

  it('can write a value to a pin using the `value` setter', (done) => createInstance((raspi) => {
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);

    const { peripheral } = raspi.getInternalPinInstances()[pin];
    raspi.pins[pin].value = 0;
    expect(peripheral.value).toEqual(0);
    raspi.pins[pin].value = 1;
    expect(peripheral.value).toEqual(1);
    done();
  }));
});
