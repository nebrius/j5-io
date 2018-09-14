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

const { EventEmitter } = require('events');
const { RaspiIOCore } = require('../dist/index');
const {
  raspiMock,
  raspiBoardMock,
  raspiGpioMock,
  raspiI2CMock,
  raspiLEDMock,
  raspiPWMMock,
  raspiSerialMock,
  raspiSoftPWMMock
} = require('./mocks');

describe('App Instantiation', () => {

  it('requires an options argument', () => {
    expect(() => {
      new RaspiIOCore();
    }).toThrow(new Error('An options object is required'));
  });

  it('requires an options argument to be an object', () => {
    expect(() => {
      new RaspiIOCore(`I'm not an object`);
    }).toThrow(new Error('An options object is required'));
  });

  it('requires the platform argument', () => {
    expect(() => {
      new RaspiIOCore({});
    }).toThrow(new Error('"platform" option is required'));
  });

  it('requires the raspi argument', () => {
    expect(() => {
      new RaspiIOCore({
        platform: {}
      });
    }).toThrow(new Error('"raspi" module is missing from "platform" option'));
  });

  it('requires the raspi-board argument', () => {
    expect(() => {
      new RaspiIOCore({
        platform: {
          'raspi': raspiMock
        }
      });
    }).toThrow(new Error('"raspi-board" module is missing from "platform" option'));
  });

  it('requires the raspi-gpio argument', () => {
    expect(() => {
      new RaspiIOCore({
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock
        }
      });
    }).toThrow(new Error('"raspi-gpio" module is missing from "platform" option'));
  });

  it('requires the raspi-i2c argument', () => {
    expect(() => {
      new RaspiIOCore({
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock,
          'raspi-gpio': raspiGpioMock
        }
      });
    }).toThrow(new Error('"raspi-i2c" module is missing from "platform" option'));
  });

  it('requires the raspi-led argument', () => {
    expect(() => {
      new RaspiIOCore({
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock,
          'raspi-gpio': raspiGpioMock,
          'raspi-i2c': raspiI2CMock
        }
      });
    }).toThrow(new Error('"raspi-led" module is missing from "platform" option'));
  });

  it('requires the raspi-pwm argument', () => {
    expect(() => {
      new RaspiIOCore({
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock,
          'raspi-gpio': raspiGpioMock,
          'raspi-i2c': raspiI2CMock,
          'raspi-led': raspiLEDMock
        }
      });
    }).toThrow(new Error('"raspi-pwm" module is missing from "platform" option'));
  });

  it('throws an error if the `raspi-serial` argument is missing and the `enableSerial` flag is set', () => {
    expect(() => {
      new RaspiIOCore({
        enableSerial: true,
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock,
          'raspi-gpio': raspiGpioMock,
          'raspi-i2c': raspiI2CMock,
          'raspi-led': raspiLEDMock,
          'raspi-pwm': raspiPWMMock
        }
      });
    }).toThrow(new Error('"enableSerial" is true and "raspi-serial" module is missing from "platform" option'));
  });

  it('does not throw an error if the `raspi-serial` argument is present and the `enableSerial` flag is set', () => {
    expect(() => {
      new RaspiIOCore({
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
    }).not.toThrow();
  });

  it('does not throw an error if the `raspi-serial` argument is not present and the `enableSerial` flag is not set', () => {
    expect(() => {
      new RaspiIOCore({
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock,
          'raspi-gpio': raspiGpioMock,
          'raspi-i2c': raspiI2CMock,
          'raspi-led': raspiLEDMock,
          'raspi-pwm': raspiPWMMock
        }
      });
    }).not.toThrow();
  });

  it('throws an error if the `raspi-soft-pwm` argument is missing and the `enableSoftPwm` flag is set', () => {
    expect(() => {
      new RaspiIOCore({
        enableSoftPwm: true,
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock,
          'raspi-gpio': raspiGpioMock,
          'raspi-i2c': raspiI2CMock,
          'raspi-led': raspiLEDMock,
          'raspi-pwm': raspiPWMMock
        }
      });
    }).toThrow(new Error('"enableSoftPwm" is true and "raspi-soft-pwm" module is missing from "platform" option'));
  });

  it('does not throw an error if the `raspi-soft-pwm` argument is present and the `enableSoftPwm` flag is set', () => {
    expect(() => {
      new RaspiIOCore({
        enableSoftPwm: true,
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock,
          'raspi-gpio': raspiGpioMock,
          'raspi-i2c': raspiI2CMock,
          'raspi-led': raspiLEDMock,
          'raspi-pwm': raspiPWMMock,
          'raspi-soft-pwm': raspiSoftPWMMock
        }
      });
    }).not.toThrow();
  });

  it('does not throw an error if the `raspi-soft-pwm` argument is not present and the `enableSoftPwm` flag is not set', () => {
    expect(() => {
      new RaspiIOCore({
        platform: {
          'raspi': raspiMock,
          'raspi-board': raspiBoardMock,
          'raspi-gpio': raspiGpioMock,
          'raspi-i2c': raspiI2CMock,
          'raspi-led': raspiLEDMock,
          'raspi-pwm': raspiPWMMock
        }
      });
    }).not.toThrow();
  });

  it('is an instance of an Event Emitter', () => {
    const raspi = new RaspiIOCore({
      platform: {
        'raspi': raspiMock,
        'raspi-board': raspiBoardMock,
        'raspi-gpio': raspiGpioMock,
        'raspi-i2c': raspiI2CMock,
        'raspi-led': raspiLEDMock,
        'raspi-pwm': raspiPWMMock
      }
    });
    expect(raspi instanceof EventEmitter).toBeTruthy();
  });
});

describe('App Initialization', () => {
  // TODO: test 'ready' and 'connected' events
  // TODO: test all built-in props, like .ready and .pins
  // TODO: test excludePins and includePins
});
