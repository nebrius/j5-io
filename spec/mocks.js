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

const { EventEmitter } = require('events');

const raspiMock = {
  init(cb) {
    setImmediate(cb);
  }
};

const raspiBoardMock = {
  VERSION_1_MODEL_A: "rpi1_a",
  VERSION_1_MODEL_B_REV_1: "rpi1_b1",
  VERSION_1_MODEL_B_REV_2: "rpi1_b2",
  VERSION_1_MODEL_B_PLUS: "rpi1_bplus",
  VERSION_1_MODEL_A_PLUS: "rpi1_aplus",
  VERSION_1_MODEL_ZERO: "rpi1_zero",
  VERSION_1_MODEL_ZERO_W: "rpi1_zerow",
  VERSION_2_MODEL_B: "rpi2_b",
  VERSION_3_MODEL_B: "rpi3_b",
  VERSION_3_MODEL_B_PLUS: "rpi3_bplus",
  VERSION_UNKNOWN: "unknown",
  getBoardRevision() {
    raspiBoardMock.VERSION_3_MODEL_B_PLUS
  },
  getPins() {
    return {
      0: {
        pins: [
          'GPIO17',
          'P1-11'
        ],
        peripherals: [
          'gpio'
        ],
        gpio: 17
      },
      1: {
        pins: [
          'GPIO18',
          'PWM0',
          'P1-12'
        ],
        peripherals: [
          'gpio',
          'pwm'
        ],
        gpio: 18
      },
      8: {
        pins: [
          'GPIO2',
          'SDA0',
          'P1-3'
        ],
        peripherals: [
          'gpio',
          'i2c'
        ],
        gpio: 2
      },
      10: {
        pins: [
          'GPIO8',
          'CE0',
          'P1-24'
        ],
        peripherals: [
          'gpio',
          'spi'
        ],
        gpio: 8
      },
      16: {
        pins: [
          'GPIO15',
          'RXD0',
          'P1-10'
        ],
        peripherals: [
          'gpio',
          'uart'
        ],
        gpio: 15
      },
    };
  },
  getPinNumber(alias) {
    return 1;
  },
  getGpioNumber(alias) {
    return 1;
  }
};

class Peripheral extends EventEmitter {
  constructor(pins) {
    this.alive = true;
    this.pins = [ 1 ];
  }
  destroy() {
    this.alive = false;
  }
  validateAlive() {
    if (!this.alive) {
      throw new Error('Is not alive');
    }
  }
}

const raspiPeripheralMock = {
  Peripheral
};

class DigitalOutput extends Peripheral {
  get value() {
    return this._value;
  }
  constructor(config) {
    super([ 0 ]);
    this._value = 0;
  }
  write(value) {
    this._value = value;
  }
}

class DigitalInput extends Peripheral {
  get value() {
    return this._value;
  }
  constructor(config) {
    super([ 0 ]);
    this._value = 0;
  }
  read() {
    return this.value;
  }
  setMockedValue(value) {
    this._value = value;
  }
}

const raspiGpioMock = {
  LOW: 0,
  HIGH: 1,
  PULL_NONE: 0,
  PULL_DOWN: 1,
  PULL_UP: 2,
  DigitalInput,
  DigitalOutput
};

module.exports = {
  raspiMock,
  raspiBoardMock,
  raspiPeripheralMock,
  raspiGpioMock
};
