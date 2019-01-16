"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const index_1 = require("../src/index");
// We can use the actual raspi-board modules in test mode here
const raspi_board_1 = require("raspi-board");
const OFF = 0;
let registeredPins = {};
function setActivePeripheral(pin, peripheral) {
    if (registeredPins[pin]) {
        registeredPins[pin].destroy();
        const peripheralPins = registeredPins[pin].pins;
        for (const peripheralPin of peripheralPins) {
            delete registeredPins[peripheralPin];
        }
    }
    registeredPins[pin] = peripheral;
}
exports.setActivePeripheral = setActivePeripheral;
exports.raspiMock = {
    init: (cb) => process.nextTick(cb),
    getActivePeripherals: () => registeredPins,
    getActivePeripheral: (pin) => registeredPins[pin],
    setActivePeripheral,
    getPinNumber: raspi_board_1.getPinNumber
};
class Peripheral extends events_1.EventEmitter {
    constructor(pins) {
        super();
        this._alive = true;
        this._pins = [];
        if (!Array.isArray(pins)) {
            pins = [pins];
        }
        for (const alias of pins) {
            const pin = raspi_board_1.getPinNumber(alias);
            if (pin === null) {
                throw new Error(`Invalid pin: ${alias}`);
            }
            this._pins.push(pin);
            setActivePeripheral(pin, this);
        }
    }
    get alive() {
        return this._alive;
    }
    get pins() {
        return this._pins;
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
function getPinFromConfig(config) {
    return [typeof config === 'number' ? config : config.pin];
}
class DigitalOutput extends Peripheral {
    constructor(...args) {
        super(getPinFromConfig(args[0]));
        this.value = OFF;
        this.args = args;
    }
    write(value) {
        this.value = value;
    }
}
class DigitalInput extends Peripheral {
    constructor(...args) {
        super(getPinFromConfig(args[0]));
        this.value = OFF;
        this.pullResistor = 0;
        this.args = args;
        if (typeof args === 'object') {
            this.pullResistor = args[0].pullResistor || 0;
        }
    }
    read() {
        return this.value;
    }
    setMockedValue(value) {
        if (value !== this.value) {
            this.value = value;
            this.emit('change', value);
        }
    }
}
exports.raspiGpioMock = {
    PULL_NONE: 0,
    PULL_DOWN: 1,
    PULL_UP: 2,
    createDigitalInput: (config) => new DigitalInput(config),
    createDigitalOutput: (config) => new DigitalOutput(config)
};
class I2C extends Peripheral {
    constructor(...args) {
        super(['SDA0', 'SCL0']);
        this._readBuffers = {};
        this.args = args;
    }
    setReadBuffer(address, register, data) {
        if (!this._readBuffers[address]) {
            this._readBuffers[address] = {};
        }
        if (!register) {
            register = -1;
        }
        this._readBuffers[address][register] = data;
    }
    read(address, registerOrLength, lengthOrCb, cb) {
        let length;
        let register;
        if (typeof cb === 'function' && typeof lengthOrCb === 'number') {
            length = lengthOrCb;
            register = registerOrLength;
        }
        else if (typeof lengthOrCb === 'function') {
            cb = lengthOrCb;
            length = registerOrLength;
            register = undefined;
        }
        setImmediate(() => {
            const data = this._mockRead(address, register, length);
            if (cb) {
                cb(null, data);
            }
            this.emit('read', { address, length, register, data });
        });
    }
    readSync(address, registerOrLength, length) {
        let register;
        if (typeof length === 'undefined') {
            length = registerOrLength;
        }
        else {
            register = registerOrLength;
            length = length;
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
            if (cb) {
                cb(null, data[0]);
            }
            this.emit('readByte', { address, register, data });
        });
    }
    readByteSync(address, register) {
        const data = this._mockRead(address, 1);
        setImmediate(() => {
            this.emit('readByteSync', { address, register, data });
        });
        return data[0];
    }
    readWord(address, registerOrCb, cb) {
        let register;
        if (typeof registerOrCb === 'function') {
            cb = registerOrCb;
        }
        else {
            register = registerOrCb;
        }
        const data = this._mockRead(address, 2);
        setImmediate(() => {
            if (cb) {
                cb(null, data[0]);
            }
            this.emit('readWord', { address, register, data });
        });
    }
    readWordSync(address, register) {
        const data = this._mockRead(address, 2);
        setImmediate(() => {
            this.emit('readByteSync', { address, register, data });
        });
        return data[0];
    }
    write(address, registerOrBuffer, bufferOrCb, cb) {
        let buffer;
        let register;
        if (Buffer.isBuffer(registerOrBuffer)) {
            cb = bufferOrCb;
            buffer = registerOrBuffer;
            register = undefined;
        }
        else if (typeof registerOrBuffer === 'number' && Buffer.isBuffer(bufferOrCb)) {
            register = registerOrBuffer;
            buffer = bufferOrCb;
        }
        else {
            throw new TypeError('Invalid I2C write arguments');
        }
        setImmediate(() => {
            if (cb) {
                cb(null);
            }
            this.emit('write', { address, register, buffer });
        });
    }
    writeSync(address, registerOrBuffer, buffer) {
        let register;
        if (Buffer.isBuffer(registerOrBuffer)) {
            buffer = registerOrBuffer;
        }
        else {
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
        }
        else {
            cb = byteOrCb;
            byte = registerOrByte;
        }
        setImmediate(() => {
            if (cb) {
                cb(null);
            }
            this.emit('writeByte', { address, register, byte });
        });
    }
    writeByteSync(address, registerOrByte, byte) {
        let register;
        if (byte === undefined) {
            byte = registerOrByte;
        }
        else {
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
        }
        else if (typeof wordOrCb === 'function') {
            word = registerOrWord;
            cb = wordOrCb;
        }
        else {
            throw new Error('Invalid I2C write arguments');
        }
        setImmediate(() => {
            if (cb) {
                cb(null);
            }
            this.emit('writeWord', { address, register, word });
        });
    }
    writeWordSync(address, registerOrWord, word) {
        let register;
        if (word === undefined) {
            word = registerOrWord;
        }
        else {
            register = registerOrWord;
        }
        setImmediate(() => {
            this.emit('writeWordSync', { address, register, word });
        });
    }
    _mockRead(address, register, length) {
        if (!this._readBuffers.hasOwnProperty(address)) {
            throw new Error(`Internal test error: attempted to read from address without data preloaded`);
        }
        if (!register) {
            register = -1;
        }
        if (!this._readBuffers[address].hasOwnProperty(register)) {
            throw new Error(`Internal test error: attempted to read from register without data preloaded`);
        }
        const readBuffer = this._readBuffers[address][register].slice(0, length);
        const unreadBuffer = this._readBuffers[address][register].slice(length);
        this._readBuffers[address][register] = unreadBuffer;
        return readBuffer;
    }
}
exports.raspiI2CMock = {
    createI2C: () => new I2C()
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
exports.raspiLEDMock = {
    createLED: () => new LED()
};
class PWM extends Peripheral {
    get frequency() {
        return this._frequencyValue;
    }
    get dutyCycle() {
        return this._dutyCycleValue;
    }
    get range() {
        return this._range;
    }
    constructor(...args) {
        const config = args[0];
        let pin = 1;
        let frequency = 50;
        if (typeof config === 'number' || typeof config === 'string') {
            pin = config;
        }
        else if (typeof config === 'object') {
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
        this._range = 1000;
        this.args = args;
    }
    write(dutyCycle) {
        this._dutyCycleValue = dutyCycle;
    }
}
exports.raspiPWMMock = {
    createPWM: (config) => new PWM(config)
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
    constructor({ portId = '/dev/ttyAMA0', baudRate = 9600, dataBits = 8, stopBits = 1, parity = 'none' } = {}) {
        const pins = ['TXD0', 'RXD0'];
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
exports.raspiSerialMock = {
    createSerial: (options) => new Serial(options)
};
exports.pinInfo = raspi_board_1.getPins();
function createInstance(options, cb) {
    if (typeof cb === 'undefined') {
        cb = options;
        options = { enableSerial: false };
    }
    registeredPins = {};
    const coreOptions = {
        pluginName: 'Raspi IO',
        pinInfo: exports.pinInfo,
        platform: {
            base: exports.raspiMock,
            gpio: exports.raspiGpioMock,
            i2c: exports.raspiI2CMock,
            led: exports.raspiLEDMock,
            pwm: exports.raspiPWMMock,
            serial: exports.raspiSerialMock
        },
        serialIds: {
            DEFAULT: '/dev/ttyAMA0'
        }
    };
    if (options && options.enableSerial) {
        coreOptions.platform.serial = exports.raspiSerialMock;
    }
    const raspi = new index_1.CoreIO(coreOptions);
    raspi.on('ready', () => cb(raspi));
}
exports.createInstance = createInstance;
//# sourceMappingURL=mocks.js.map