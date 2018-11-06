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
const { RaspiIOCore } = require('../dist/index');

const OFF = 0;
const ON = 1;

const raspiMock = {
  init(cb) {
    setImmediate(cb);
  }
};

// We can use the actual raspi-board module in test mode here
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
  constructor(...args) {
    super([ 0 ]);
    this.value = OFF;
    this.args = args;
  }
  write(value) {
    this.value = value;
  }
}

class DigitalInput extends Peripheral {
  constructor(...args) {
    super([ 0 ]);
    this.value = OFF;
    this.args = args;
  }
  read() {
    return this.value;
  }
  setMockedValue(value) {
    this.value = value;
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

  constructor(...args) {
    super([ 'SDA0', 'SCL0' ]);
    this._readBuffers = {};
    this.args = args;
  }

  _mockRead(address, length) {
    if (!this._readBuffers.hasOwnProperty(address)) {
      throw new Error(`Internal test error: attempted to read from address without data preloaded`);
    }
    return this._readBuffers[address].splice(0, length);
  }

  setReadBuffer(address, data) {
    this._readBuffers[address] = data;
  }

  read(address, registerOrLength, lengthOrCb, cb) {
    let length;
    let register;
    if (typeof cb === 'function' && typeof lengthOrCb === 'number') {
      length = lengthOrCb;
      register = registerOrLength;
    } else if (typeof lengthOrCb === 'function') {
      cb = lengthOrCb;
      length = registerOrLength;
      register = undefined;
    }
    setImmediate(() => {
      const data = this._mockRead(address, length);
      cb(undefined, data);
      this.emit('read', { address, length, register, data });
    })
  }

  readSync(address, registerOrLength, length) {
    let register;
    if (typeof length === 'undefined') {
      length = +(registerOrLength);
    } else {
      register = registerOrLength;
      length = +length;
    }
    const data = this._mockRead(address, length);
    setImmediate(() => {
      this.emit('readSync', { address, register, length, data });
    });
    return data;
  }

  readByte(address, registerOrCb, cb) {
    let register;
    if (typeof registerOrCb === 'function') {
      cb = registerOrCb;
      register = undefined;
    }
    setImmediate(() => {
      const data = this._mockRead(address, 1);
      cb(undefined, data);
      this.emit('readByte', { address, register, data });
    });
  }

  readByteSync(address, register) {
    const data = this._mockRead(address, 1);
    setImmediate(() => {
      this.emit('readByteSync', { address, register, data });
    });
    return data;
  }

  readWord(address, registerOrCb, cb) {
    let register;
    if (typeof registerOrCb === 'function') {
      cb = registerOrCb;
    } else {
      register = registerOrCb;
    }
    const data = this._mockRead(address, 2);
    setImmediate(() => {
      cb(undefined, data);
      this.emit('readWord', { address, register, data });
    });
  }

  readWordSync(address, register) {
    const data = this._mockRead(address, 2);
    setImmediate(() => {
      this.emit('readByteSync', { address, register, data });
    });
    return data;
  }

  write(address, registerOrBuffer, bufferOrCb, cb) {
    let buffer;
    let register;
    if (Buffer.isBuffer(registerOrBuffer)) {
      cb = bufferOrCb;
      buffer = registerOrBuffer;
      register = undefined;
    } else if (typeof registerOrBuffer === 'number' && Buffer.isBuffer(bufferOrCb)) {
      register = registerOrBuffer;
      buffer = bufferOrCb;
    } else {
      throw new TypeError('Invalid I2C write arguments');
    }
    setImmediate(() => {
      cb();
      this.emit('write', { address, register, buffer });
    });
  }

  writeSync(address, registerOrBuffer, buffer) {
    let register;
    if (Buffer.isBuffer(registerOrBuffer)) {
      buffer = registerOrBuffer;
    } else {
      if (!buffer) {
        throw new Error('Invalid I2C write arguments');
      }
      register = registerOrBuffer;
    }
    setImmediate(() => {
      this.emit('writeSync', { address, register, buffer });
    });
  }

  writeByte(address, registerOrByte, byteOrCb, cb) {
    let byte;
    let register;
    if (typeof byteOrCb === 'number') {
      byte = byteOrCb;
      register = registerOrByte;
    } else {
      cb = byteOrCb;
      byte = registerOrByte;
    }
    setImmediate(() => {
      cb();
      this.emit('writeByte', { address, register, byte });
    });
  }

  writeByteSync(address, registerOrByte, byte) {
    let register;
    if (byte === undefined) {
      byte = registerOrByte;
    } else {
      register = registerOrByte;
    }
    setImmediate(() => {
      this.emit('writeByteSync', { address, register, byte });
    });
  }

  writeWord(address, registerOrWord, wordOrCb, cb) {
    let register;
    let word;
    if (typeof wordOrCb === 'number') {
      register = registerOrWord;
      word = wordOrCb;
    } else if (typeof wordOrCb === 'function') {
      word = registerOrWord;
      cb = wordOrCb;
    } else {
      throw new Error('Invalid I2C write arguments');
    }
    setImmediate(() => {
      cb();
      this.emit('writeWord', { address, register, word });
    });
  }

  writeWordSync(address, registerOrWord, word) {
    let register;
    if (word === undefined) {
      word = registerOrWord;
    } else {
      register = registerOrWord;
    }
    setImmediate(() => {
      this.emit('writeWordSync', { address, register, word });
    });
  }
}

const raspiI2CMock = {
  I2C
};

class LED extends Peripheral {
  constructor(...args) {
    super([]);
    this._value = OFF;
    this.args = args;
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
  constructor(...args) {
    let config = args[0];
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
    this.args = args;
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
    setImmediate(() => {
      cb();
      this.emit('open');
    });
  }
  close(cb) {
    setImmediate(() => {
      cb();
      this.emit('close');
    });
  }
  write(data, cb) {
    setImmediate(() => {
      cb();
      this.emit('write', data);
    });
  }
  flush(cb) {
    setImmediate(() => {
      cb();
      this.emit('flush');
    });
  }
  fillReadBuffer(data) {
    this.emit('data', data);
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

module.exports = {
  raspiMock,
  raspiBoardMock,
  raspiPeripheralMock,
  raspiGpioMock,
  raspiI2CMock,
  raspiLEDMock,
  raspiPWMMock,
  raspiSerialMock,
  raspiSoftPWMMock,
  createInstance
};
