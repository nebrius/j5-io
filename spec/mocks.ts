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

import { EventEmitter } from 'events';
import {
  IPeripheral, IPinInfo,
  IBaseModule,
  IGPIOModule, IDigitalInput, IDigitalOutput,
  I2CWriteCallback, I2CReadBufferCallback, I2CReadNumberCallback, II2CModule, II2C,
  ILED, ILEDModule,
  IPWMModule, IPWM,
  ISerial, ISerialOptions, ISerialModule
} from 'core-io-types';
import { CoreIO, IOptions } from '../src/index';

// We can use the actual raspi-board modules in test mode here
import { getPinNumber, getPins } from 'raspi-board';

const OFF = 0;

let registeredPins: { [ pinNumber: string ]: IPeripheral } = {};

export function setActivePeripheral(pin: number, peripheral: IPeripheral): void {
  if (registeredPins[pin]) {
    registeredPins[pin].destroy();
    const peripheralPins = registeredPins[pin].pins;
    for (const peripheralPin of peripheralPins) {
      delete registeredPins[peripheralPin];
    }
  }
  registeredPins[pin] = peripheral;
}

export const raspiMock: IBaseModule = {
  init: (cb: () => void) => process.nextTick(cb),
  getActivePeripherals: () => registeredPins,
  getActivePeripheral: (pin: number) => registeredPins[pin],
  setActivePeripheral,
  getPinNumber
};

export class Peripheral extends EventEmitter implements IPeripheral {

  public get alive() {
    return this._alive;
  }
  public get pins() {
    return this._pins;
  }

  private _alive = true;
  private _pins: number[] = [];

  constructor(pins: string | number | Array<string | number>) {
    super();
    if (!Array.isArray(pins)) {
      pins = [ pins ];
    }
    for (const alias of pins) {
      const pin = getPinNumber(alias);
      if (pin === null) {
        throw new Error(`Invalid pin: ${alias}`);
      }
      this._pins.push(pin);
      setActivePeripheral(pin, this);
    }
  }

  public destroy() {
    if (this._alive) {
      this._alive = false;
      this.emit('destroyed');
    }
  }

  public validateAlive() {
    if (!this._alive) {
      throw new Error('Attempted to access a destroyed peripheral');
    }
  }
}

function getPinFromConfig(config: number | { pin: number }): number[] {
  return [ typeof config === 'number' ? config : config.pin ];
}

export class DigitalOutput extends Peripheral implements IDigitalOutput {

  public get value() {
    return this._value;
  }
  public args: any[];

  private _value = OFF;

  constructor(...args: any[]) {
    super(getPinFromConfig(args[0]));
    this.args = args;
  }
  public write(value: number) {
    this._value = value;
  }
}

export class DigitalInput extends Peripheral implements IDigitalInput {

  public get value() {
    return this._value;
  }
  public args: any[];
  public pullResistor = 0;

  private _value = OFF;

  constructor(...args: any[]) {
    super(getPinFromConfig(args[0]));
    this.args = args;
    if (typeof args === 'object') {
      this.pullResistor = args[0].pullResistor || 0;
    }
  }

  public read() {
    return this.value;
  }

  public setMockedValue(value: number) {
    this._value = value;
    this.emit('change', value);
  }
}

export const raspiGpioMock: IGPIOModule = {
  PULL_NONE: 0,
  PULL_DOWN: 1,
  PULL_UP: 2,
  createDigitalInput: (config) => new DigitalInput(config),
  createDigitalOutput: (config) => new DigitalOutput(config)
};

class I2C extends Peripheral implements II2C {

  public args: any[];

  private _readBuffers: { [ address: number ]: { [ register: number ]: Buffer } } = {};

  constructor(...args: any[]) {
    super([ 'SDA0', 'SCL0' ]);
    this.args = args;
  }

  public setReadBuffer(address: number, register: number, data: Buffer) {
    if (!this._readBuffers[address]) {
      this._readBuffers[address] = {};
    }
    if (!register) {
      register = -1;
    }
    this._readBuffers[address][register] = data;
  }

  public read(
    address: number,
    registerOrLength: number,
    lengthOrCb: number | I2CReadBufferCallback,
    cb?: I2CReadBufferCallback
  ): void {
    let length: number;
    let register: number | undefined;
    if (typeof cb === 'function' && typeof lengthOrCb === 'number') {
      length = lengthOrCb;
      register = registerOrLength;
    } else if (typeof lengthOrCb === 'function') {
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

  public readSync(address: number, registerOrLength: number | undefined, length?: number): Buffer {
    let register: number | undefined;
    if (typeof length === 'undefined') {
      length = registerOrLength;
    } else {
      register = registerOrLength;
      length = length;
    }
    const data = this._mockRead(address, length);
    setImmediate(() => {
      this.emit('readSync', { address, register, length, data });
    });
    return data;
  }

  public readByte(address: number, registerOrCb: number | I2CReadNumberCallback, cb?: I2CReadNumberCallback): void {
    let register: number | undefined;
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

  public readByteSync(address: number, register?: number): number {
    const data = this._mockRead(address, 1);
    setImmediate(() => {
      this.emit('readByteSync', { address, register, data });
    });
    return data[0];
  }

  public readWord(address: number, registerOrCb: number | I2CReadNumberCallback, cb?: I2CReadNumberCallback): void {
    let register: number | undefined;
    if (typeof registerOrCb === 'function') {
      cb = registerOrCb;
    } else {
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

  public readWordSync(address: number, register?: number): number {
    const data = this._mockRead(address, 2);
    setImmediate(() => {
      this.emit('readByteSync', { address, register, data });
    });
    return data[0];
  }

  public write(
    address: number,
    registerOrBuffer: number | Buffer,
    bufferOrCb?: Buffer | I2CWriteCallback,
    cb?: I2CWriteCallback
  ): void {
    let buffer: Buffer;
    let register: number | undefined;
    if (Buffer.isBuffer(registerOrBuffer)) {
      cb = bufferOrCb as I2CWriteCallback;
      buffer = registerOrBuffer;
      register = undefined;
    } else if (typeof registerOrBuffer === 'number' && Buffer.isBuffer(bufferOrCb)) {
      register = registerOrBuffer;
      buffer = bufferOrCb;
    } else {
      throw new TypeError('Invalid I2C write arguments');
    }
    setImmediate(() => {
      if (cb) {
        cb(null);
      }
      this.emit('write', { address, register, buffer });
    });
  }

  public writeSync(address: number, registerOrBuffer: number | Buffer, buffer?: Buffer): void {
    let register: number | undefined;
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

  public writeByte(
    address: number,
    registerOrByte: number,
    byteOrCb?: number | I2CWriteCallback,
    cb?: I2CWriteCallback
  ): void {
    let byte: number;
    let register: number | undefined;
    if (typeof byteOrCb === 'number') {
      byte = byteOrCb;
      register = registerOrByte;
    } else {
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

  public writeByteSync(address: number, registerOrByte: number, byte?: number): void {
    let register: number | undefined;
    if (byte === undefined) {
      byte = registerOrByte;
    } else {
      register = registerOrByte;
    }
    setImmediate(() => {
      this.emit('writeByteSync', { address, register, byte });
    });
  }

  public writeWord(
    address: number,
    registerOrWord: number,
    wordOrCb?: number | I2CWriteCallback,
    cb?: I2CWriteCallback
  ): void {
    let register: number | undefined;
    let word: number;
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
      if (cb) {
        cb(null);
      }
      this.emit('writeWord', { address, register, word });
    });
  }

  public writeWordSync(address: number, registerOrWord: number, word?: number): void {
    let register: number | undefined;
    if (word === undefined) {
      word = registerOrWord;
    } else {
      register = registerOrWord;
    }
    setImmediate(() => {
      this.emit('writeWordSync', { address, register, word });
    });
  }

  private _mockRead(address: number, register: number | undefined, length?: number) {
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

export const raspiI2CMock: II2CModule = {
  createI2C: () => new I2C()
};

export class LED extends Peripheral implements ILED {

  public args: any[];
  private _value = OFF;

  constructor(...args: any[]) {
    super([]);
    this.args = args;
  }
  public hasLed() {
    return true;
  }
  public read() {
    return this._value;
  }
  public write(value: number) {
    this._value = value;
  }
}

export const raspiLEDMock: ILEDModule = {
  createLED: () => new LED()
};

export class PWM extends Peripheral implements IPWM {
  get frequency() {
    return this._frequencyValue;
  }
  get dutyCycle() {
    return this._dutyCycleValue;
  }
  get range() {
    return this._range;
  }
  public args: any[];

  private _frequencyValue: number;
  private _dutyCycleValue: number;
  private _range: number;

  constructor(...args: any[]) {
    const config = args[0];
    let pin: string | number = 1;
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
    this._range = 1000;
    this.args = args;
  }
  public write(dutyCycle: number) {
    this._dutyCycleValue = dutyCycle;
  }
}

export const raspiPWMMock: IPWMModule = {
  createPWM: (config) => new PWM(config)
};

class Serial extends Peripheral implements ISerial {
  get port() {
    return this._portId;
  }
  get baudRate() {
    return this._options.baudRate as number;
  }

  get dataBits() {
    return this._options.dataBits as number;
  }

  get stopBits() {
    return this._options.stopBits as number;
  }

  get parity() {
    return this._options.parity as string;
  }

  private _portId: string;
  private _options: ISerialOptions;

  constructor({
    portId = '/dev/ttyAMA0',
    baudRate = 9600,
    dataBits = 8,
    stopBits = 1,
    parity = 'none'
  }: ISerialOptions = {}) {
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
  public open(cb: () => void) {
    setImmediate(() => {
      cb();
      this.emit('open');
    });
  }
  public close(cb: () => void) {
    setImmediate(() => {
      cb();
      this.emit('close');
    });
  }
  public write(data: Buffer | string, cb: () => void) {
    setImmediate(() => {
      cb();
      this.emit('write', data);
    });
  }
  public flush(cb: () => void) {
    setImmediate(() => {
      cb();
      this.emit('flush');
    });
  }
  public fillReadBuffer(data: Buffer | string) {
    this.emit('data', data);
  }
}

export const raspiSerialMock: ISerialModule = {
  createSerial: (options) => new Serial(options)
};

export const pinInfo: { [ pin: number ]: IPinInfo } = getPins();

export type CreateCallback = (instance: CoreIO) => void;
export interface ICreateOptions {
  enableSerial?: boolean;
  enableDefaultLED?: boolean;
}

export function createInstance(options: CreateCallback | ICreateOptions, cb?: CreateCallback): void {
  if (typeof cb === 'undefined') {
    cb = options as CreateCallback;
    options = {};
  }
  if (typeof (options as ICreateOptions).enableDefaultLED === 'undefined') {
    (options as ICreateOptions).enableDefaultLED = true;
  }
  if (typeof (options as ICreateOptions).enableSerial === 'undefined') {
    (options as ICreateOptions).enableSerial = false;
  }
  registeredPins = {};
  const coreOptions: IOptions = {
    pluginName: 'Raspi IO',
    pinInfo,
    platform: {
      base: raspiMock,
      gpio: raspiGpioMock,
      i2c: raspiI2CMock,
      pwm: raspiPWMMock,
      serial: raspiSerialMock
    },
    serialIds: {
      DEFAULT: '/dev/ttyAMA0'
    }
  };
  if (options && (options as ICreateOptions).enableSerial) {
    coreOptions.platform.serial = raspiSerialMock;
  }
  if (options && (options as ICreateOptions).enableDefaultLED) {
    coreOptions.platform.led = raspiLEDMock;
  }
  const raspi = new CoreIO(coreOptions);
  raspi.on('ready', () => (cb as CreateCallback)(raspi));
}
