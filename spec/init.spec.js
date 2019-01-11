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
const { CoreIO } = require('../dist/index');
const {
  raspiMock,
  raspiGpioMock,
  raspiPWMMock,
  raspiSerialMock,
  pinInfo,
  createInstance,
  pinInfo: boardPins
} = require('./mocks');

describe('App Instantiation', () => {

  it('requires an options argument', () => {
    expect(() => {
      new CoreIO();
    }).toThrow(new Error('"options" is required and must be an object'));
  });

  it('requires an options argument to be an object', () => {
    expect(() => {
      new CoreIO(`I'm not an object`);
    }).toThrow(new Error('"options" is required and must be an object'));
  });

  it('requires the pluginName argument', () => {
    expect(() => {
      new CoreIO({});
    }).toThrow(new Error('"options.pluginName" is required and must be a string'));
  });

  it('requires the pluginName argument to be a string', () => {
    expect(() => {
      new CoreIO({
        pluginName: 10
      });
    }).toThrow(new Error('"options.pluginName" is required and must be a string'));
  });

  it('requires the pinInfo argument', () => {
    expect(() => {
      new CoreIO({
        pluginName: 'Raspi IO'
      });
    }).toThrow(new Error('"options.pinInfo" is required and must be an object'));
  });

  it('requires the platform argument', () => {
    expect(() => {
      new CoreIO({
        pluginName: 'Raspi IO',
        pinInfo: {}
      });
    }).toThrow(new Error('"options.platform" is required and must be an object'));
  });

  it('requires the platform.base argument', () => {
    expect(() => {
      new CoreIO({
        pluginName: 'Raspi IO',
        pinInfo,
        platform: {}
      });
    }).toThrow(new Error('"options.platform.base" is required and must be an object'));
  });

  it('requires the platform.gpio argument', () => {
    expect(() => {
      new CoreIO({
        pluginName: 'Raspi IO',
        pinInfo,
        platform: {
          base: raspiMock
        }
      });
    }).toThrow(new Error('"options.platform.gpio" is required and must be an object'));
  });

  it('requires the platform.pwm argument', () => {
    expect(() => {
      new CoreIO({
        pluginName: 'Raspi IO',
        pinInfo,
        platform: {
          base: raspiMock,
          gpio: raspiGpioMock
        }
      });
    }).toThrow(new Error('"options.platform.pwm" is required and must be an object'));
  });

  it('is an instance of an Event Emitter', () => {
    const raspi = new CoreIO({
      pluginName: 'Raspi IO',
      pinInfo,
      platform: {
        base: raspiMock,
        gpio: raspiGpioMock,
        pwm: raspiPWMMock
      }
    });
    expect(raspi instanceof EventEmitter).toBeTruthy();
  });
});

describe('App Initialization', () => {
  it('emits "ready" and "connect" events on initialization', (done) => {
    const raspi = new CoreIO({
      pluginName: 'Raspi IO',
      pinInfo,
      platform: {
        base: raspiMock,
        gpio: raspiGpioMock,
        pwm: raspiPWMMock
      }
    });
    expect(raspi.hasOwnProperty('isReady')).toBeTruthy();
    expect(raspi.isReady).toBe(false);
    let readyEmitted = false;
    let connectEmitted = false;
    function finalize() {
      if (readyEmitted && connectEmitted) {
        expect(raspi.isReady).toBe(true);
        done();
      }
    }
    raspi.on('ready', () => {
      readyEmitted = true;
      finalize();
    });
    raspi.on('connect', () => {
      connectEmitted = true;
      finalize();
    });
  });

  function isPropertyFrozenAndReadOnly(obj, property) {
    expect(property in obj).toBeTruthy();
    expect(Object.isFrozen(obj[property])).toBeTruthy();

    // We have to loop up the prototype chain, cause sometimes these properties come from the Abstract IO base class
    let descriptor;
    let proto = obj;
    while (proto !== null) {
      descriptor = Object.getOwnPropertyDescriptor(proto, property);
      if (descriptor) {
        break;
      }
      proto = Object.getPrototypeOf(proto);
    }
    expect(descriptor).not.toBeUndefined();
    expect(descriptor.writable).toBeFalsy();
  }

  it('creates the `MODES` property', (done) => createInstance((raspi) => {
    isPropertyFrozenAndReadOnly(raspi, 'MODES');
    expect(raspi.MODES).toEqual(Object.freeze({
      INPUT: 0,
      OUTPUT: 1,
      ANALOG: 2,
      PWM: 3,
      SERVO: 4
    }));
    done();
  }));

  it('creates the `SERIAL_PORT_IDs` property', (done) => createInstance((raspi) => {
    isPropertyFrozenAndReadOnly(raspi, 'SERIAL_PORT_IDs');
    expect(raspi.SERIAL_PORT_IDs).toEqual(Object.freeze({
      HW_SERIAL0: raspiSerialMock.DEFAULT_PORT,
      DEFAULT: raspiSerialMock.DEFAULT_PORT
    }));
    done();
  }));

  it('creates the `pins` property', (done) => createInstance((raspi) => {
    isPropertyFrozenAndReadOnly(raspi, 'pins');
    const pins = [];
    Object.keys(boardPins).forEach((pin) => {
      const supportedModes = [];
      const pinInfo = boardPins[pin];
      if (pinInfo.peripherals.indexOf('i2c') == -1 && pinInfo.peripherals.indexOf('uart') == -1) {
        if (pin == -1) {
          supportedModes.push(1);
        } else if (pinInfo.peripherals.indexOf('gpio') != -1) {
          supportedModes.push(0, 1);
        }
        if (pinInfo.peripherals.indexOf('pwm') != -1) {
          supportedModes.push(3, 4);
        }
      }
      const mode = supportedModes.indexOf(1) == -1 ? 99 : 1;
      pins[pin] = {
        supportedModes,
        mode,
        value: mode == 1 ? 0 : null,
        report: 1,
        analogChannel: 127
      };
    });
    for (let i = 0; i < pins.length; i++) {
      if (!pins[i]) {
        pins[i] = {
          supportedModes: Object.freeze([]),
          mode: 99,
          value: 0,
          report: 1,
          analogChannel: 127
        };
      }
    }
    expect(raspi.pins).toEqual(pins);
    done();
  }));

  it('creates the `analogPins` property', (done) => createInstance((raspi) => {
    isPropertyFrozenAndReadOnly(raspi, 'analogPins');
    expect(raspi.analogPins).toEqual([]);
    done();
  }));
});
