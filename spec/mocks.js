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

const OFF = 0;
const ON = 1;

const raspiMock = {
  init(cb) {
    setImmediate(cb);
  }
};

// We can use the actual raspi-board module in test mode here
global.raspiTest = true; // TODO: convert raspi-board to use RASPI-TEST-MODE env variable
const raspiBoardMock = require('raspi-board');

class Peripheral extends EventEmitter {
  get alive() {
    return this._alive;
  }
  get pins() {
    return this._pins;
  }
  constructor(pins) {
    super();
    this._alive = true;
    this._pins = [];
    if (!Array.isArray(pins)) {
      pins = [ pins ];
    }
    for (const alias of pins) {
      const pin = raspiBoardMock.getPinNumber(alias);
      if (pin === null) {
        throw new Error(`Invalid pin: ${alias}`);
      }
      this._pins.push(pin);
    }
  }
  destroy() {
    if (this._alive) {
      this._alive = false;
      this.emit('destroyed');
    }
  }
  validateAlive() {
    if (!this._alive) {
      throw new Error('Attempted to access a destroyed peripheral');
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
  get args() {
    return this._args;
  }
  constructor(...args) {
    super([ 0 ]);
    this._value = OFF;
    this._args = args;
  }
  write(value) {
    this._value = value;
  }
}

class DigitalInput extends Peripheral {
  get value() {
    return this._value;
  }
  get args() {
    return this._args;
  }
  constructor(...args) {
    super([ 0 ]);
    this._value = OFF;
    this._args = args;
  }
  read() {
    return this._value;
  }
  setMockedValue(value) {
    this._value = value;
  }
}

const raspiGpioMock = {
  LOW: OFF,
  HIGH: ON,
  PULL_NONE: 0,
  PULL_DOWN: 1,
  PULL_UP: 2,
  DigitalInput,
  DigitalOutput
};

class I2C extends Peripheral {
  constructor() {
    super([ 'SDA0', 'SCL0' ]);
  }
  // constructor();
  // destroy(): void;
  // read(address: number, length: number, cb: ReadCallback): void;
  // read(address: number, register: number, length: number, cb: ReadCallback): void;
  // readSync(address: number, registerOrLength: number | undefined, length?: number): Buffer;
  // readByte(address: number, cb: ReadCallback): void;
  // readByte(address: number, register: number, cb: ReadCallback): void;
  // readByteSync(address: number, register?: number): number;
  // readWord(address: number, cb: ReadCallback): void;
  // readWord(address: number, register: number, cb: ReadCallback): void;
  // readWordSync(address: number, register?: number): number;
  // write(address: number, buffer: Buffer, cb?: WriteCallback): void;
  // write(address: number, register: number, buffer: Buffer, cb?: WriteCallback): void;
  // writeSync(address: number, buffer: Buffer): void;
  // writeSync(address: number, register: number, buffer: Buffer): void;
  // writeByte(address: number, byte: number, cb?: WriteCallback): void;
  // writeByte(address: number, register: number, byte: number, cb?: WriteCallback): void;
  // writeByteSync(address: number, registerOrByte: number, byte?: number): void;
  // writeWord(address: number, word: number, cb?: WriteCallback): void;
  // writeWord(address: number, register: number, word: number, cb?: WriteCallback): void;
  // writeWordSync(address: number, registerOrWord: number, word?: number): void;
}

const raspiI2CMock = {
  I2C
};

class LED extends Peripheral {
  constructor() {
    super([]);
    this._value = OFF;
  }
  hasLed() {
    return true;
  }
  read() {
    return this._value;
  }
  write(value) {
    this._value = value;
  }
}

const raspiLEDMock = {
  OFF: 0,
  ON: 1,
  LED
};

class PWM extends Peripheral {
  get frequency() {
    return this._frequencyValue;
  }
  get dutyCycle() {
    return this._dutyCycleValue;
  }
  constructor(config) {
    let pin = 1;
    let frequency = 50;
    if (typeof config === 'number' || typeof config === 'string') {
      pin = config;
    } else if (typeof config === 'object') {
      if (typeof config.pin === 'number' || typeof config.pin === 'string') {
        pin = config.pin;
      }
      if (typeof config.frequency === 'number') {
        frequency = config.frequency;
      }
    }
    super(pin);
    this._frequencyValue = frequency;
    this._dutyCycleValue = 0;
  }
  write(dutyCycle) {
    this._dutyCycleValue = dutyCycle;
  }
}

const raspiPWMMock = {
  PWM
};

class Serial extends Peripheral {
  get port() {
    return this._portId;
  }
  get baudRate() {
    return this._options.baudRate;
  }

  get dataBits() {
    return this._options.dataBits;
  }

  get stopBits() {
    return this._options.stopBits;
  }

  get parity() {
    return this._options.parity;
  }

  constructor({
    portId = "/dev/ttyAMA0",
    baudRate = 9600,
    dataBits = 8,
    stopBits = 1,
    parity = "none"
  } = {}) {
    const pins = [ 'TXD0', 'RXD0' ];
    super(pins);
    this._portId = portId;
    this._options = {
      portId,
      baudRate,
      dataBits,
      stopBits,
      parity
    };
  }
  open(cb) {
    setImmediate(cb);
  }
  close(cb) {
    setImmediate(cb);
  }
  write(data, cb) {
    setImmediate(cb);
  }
  flush(cb) {
    setImmediate(cb);
  }
}

const raspiSerialMock = {
  PARITY_NONE: "none",
  PARITY_EVEN: "even",
  PARITY_ODD: "odd",
  PARITY_MARK: "mark",
  PARITY_SPACE: "space",
  DEFAULT_PORT: "/dev/ttyAMA0",
  Serial
};

class SoftPWM extends Peripheral {
  get frequency() {
    return this._frequency;
  }
  get range() {
    return this._range;
  }
  get dutyCycle() {
    return this._dutyCycle;
  }
  constructor(config) {
    let pin;
    let frequency = 50;
    let range = 40000;
    if (typeof config === 'number' || typeof config === 'string') {
      pin = config;
    } else if (typeof config === 'object') {
      if (typeof config.pin === 'number' || typeof config.pin === 'string') {
        pin = config.pin;
      } else {
        throw new Error(`Invalid pin "${config.pin}". Pin must a number or string`);
      }
      if (typeof config.frequency === 'number') {
        frequency = config.frequency;
      }
      if (typeof config.range === 'number') {
        range = config.range;
      }
    } else {
      throw new Error('Invalid config, must be a number, string, or object');
    }
    super(pin);
    this._frequency = frequency;
    this._range = range;
    this._dutyCycle = 0;
  }
  write(dutyCycle) {
    this._dutyCycle = dutyCycle;
  }
}

const raspiSoftPWMMock = {
  SoftPWM
};

module.exports = {
  raspiMock,
  raspiBoardMock,
  raspiPeripheralMock,
  raspiGpioMock,
  raspiI2CMock,
  raspiLEDMock,
  raspiPWMMock,
  raspiSerialMock,
  raspiSoftPWMMock
};
