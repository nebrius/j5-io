/*
Copyright (c) Bryan Hughes <bryan@nebri.us>

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

import {
  IBaseModule,
  IGPIOModule, IDigitalInput, IDigitalOutput,
  ILEDModule,
  IPWMModule,
  ISerialModule,
  II2CModule,
  IPeripheral,
  IPinInfo,
  PeripheralType,
  ILED,
  II2C
} from 'j5-io-types';
import {
  AbstractIO,
  Value,
  Mode,
  IPinConfiguration,
  ISerialConfig,
  IServoConfig,
  II2CConfig,
  Handler
} from 'abstract-io';
import {
  setBaseModule,
  normalizePin,
  getPeripherals,
  getMode,
  getPeripheral,
  createInternalErrorMessage
} from './core';

import { GPIOManager } from './managers/gpio';
import { PWMManager } from './managers/pwm';
import { LEDManager, DEFAULT_LED_PIN } from './managers/led';
import { SerialManager } from './managers/serial';
import { I2CManager } from './managers/i2c';

// Private symbols for public getters
const serialPortIds = Symbol('serialPortIds');
const i2cPortIds = Symbol('i2cPortIds');
const name = Symbol('name');
const isReady = Symbol('isReady');
const pins = Symbol('pins');
const defaultLed = Symbol('defaultLed');

// Private symbols for internal properties
const gpioManager = Symbol('gpioManager');
const pwmManager = Symbol('pwmManager');
const ledManager = Symbol('ledManager');
const serialManager = Symbol('serialManager');
const i2cManager = Symbol('i2cManager');
const swizzleI2CReadArguments = Symbol('swizzleI2CReadArguments');

export interface IOptions {
  pluginName: string;
  platform: {
    base: IBaseModule,
    gpio: IGPIOModule,
    pwm: IPWMModule,
    led?: ILEDModule,
    serial?: ISerialModule,
    i2c?: II2CModule
  };
  serialIds?: { [ id: string ]: any };
  i2cIds?: { [ id: string ]: any };
  pinInfo: { [ pin: number ]: IPinInfo };
}

export class J5IO extends AbstractIO {

  public get defaultLed() {
    if (this[ledManager]) {
      return this[defaultLed];
    } else {
      throw new Error(`${this.name} does not have a default LED`);
    }
  }

  public get name() {
    return this[name];
  }

  public get SERIAL_PORT_IDs() {
    return this[serialPortIds];
  }

  public get I2C_PORT_IDS() {
    return this[i2cPortIds];
  }

  public get pins(): ReadonlyArray<IPinConfiguration> {
    return Object.freeze(this[pins]);
  }

  public get analogPins(): ReadonlyArray<number> {
   return Object.freeze([]);
  }

  public get isReady(): boolean {
    return this[isReady];
  }

  public getInternalPinInstances?: () => { [ pin: number ]: IPeripheral };
  public getI2CInstance?: (portId: string | number) => II2C | undefined;
  public getLEDInstance?: () => ILED | undefined;

  private [serialPortIds]: { [ id: string ]: any };
  private [i2cPortIds]: { [ id: string ]: any };
  private [isReady] = false;
  private [pins]: IPinConfiguration[] = [];
  private [name]: string;
  private [defaultLed]: number | undefined;

  private [gpioManager]: GPIOManager;
  private [pwmManager]: PWMManager;
  private [ledManager]?: LEDManager;
  private [serialManager]?: SerialManager;
  private [i2cManager]?: I2CManager;

  constructor(options: IOptions) {
    super();

    // Verify the options. It's not very thorough, but should be sufficient
    if (typeof options !== 'object') {
      throw new Error('"options" is required and must be an object');
    }
    if (typeof options.pluginName !== 'string') {
      throw new Error('"options.pluginName" is required and must be a string');
    }
    if (typeof options.pinInfo !== 'object') {
      throw new Error('"options.pinInfo" is required and must be an object');
    }
    if (typeof options.platform !== 'object') {
      throw new Error('"options.platform" is required and must be an object');
    }
    if (typeof options.platform.base !== 'object') {
      throw new Error('"options.platform.base" is required and must be an object');
    }
    if (typeof options.platform.gpio !== 'object') {
      throw new Error('"options.platform.gpio" is required and must be an object');
    }
    if (typeof options.platform.pwm !== 'object') {
      throw new Error('"options.platform.pwm" is required and must be an object');
    }
    if (typeof options.platform.serial === 'object') {
      if (typeof options.serialIds !== 'object') {
        throw new Error(
          '"options.serialIds" is required and must be an object when options.platform.serial is also supplied');
      }
      if (typeof options.serialIds.DEFAULT === 'undefined') {
        throw new Error('"DEFAULT" serial ID is required in options.serialIds');
      }
    }
    if (typeof options.platform.i2c === 'object') {
      if (typeof options.i2cIds !== 'object') {
        throw new Error(
          '"options.i2cIds" is required and must be an object when options.platform.i2c is also supplied');
      }
      if (typeof options.i2cIds.DEFAULT === 'undefined') {
        throw new Error('"DEFAULT" I2C ID is required in options.i2cIds');
      }
    }

    // Create the plugin name
    this[name] = options.pluginName;

    const { pinInfo, serialIds, i2cIds, platform } = options;

    // Create the serial port IDs if serial is supported
    if (serialIds) {
      this[serialPortIds] = Object.freeze(serialIds);
    } else {
      this[serialPortIds] = Object.freeze({});
    }

    // Create the I2C port IDs if I2C is supported
    if (i2cIds) {
      this[i2cPortIds] = Object.freeze(i2cIds);
    } else {
      this[i2cPortIds] = Object.freeze({});
    }

    // Instantiate the peripheral managers
    setBaseModule(platform.base);
    this[gpioManager] = new GPIOManager(platform.gpio, this);
    this[pwmManager] = new PWMManager(platform.pwm);
    if (platform.led) {
      this[defaultLed] = DEFAULT_LED_PIN;
      this[ledManager] = new LEDManager(platform.led);
    }
    if (platform.serial && serialIds) {
      this[serialManager] = new SerialManager(platform.serial, serialIds, this);
    }
    if (platform.i2c && i2cIds) {
      this[i2cManager] = new I2CManager(platform.i2c, i2cIds, this);
    }

    // Inject the test only methods if we're in test mode
    if (process.env.RASPI_IO_TEST_MODE) {
      this.getInternalPinInstances = () => getPeripherals();
      this.getLEDInstance = () => this[ledManager] && (this[ledManager] as LEDManager).led;
      this.getI2CInstance = (portId) => this[i2cManager] && (this[i2cManager] as I2CManager).getI2CInstance(portId);
    }

    // Create the pins object
    this[pins] = [];
    const pinMappings = { ...pinInfo };

    function createPinEntry(pin: number, pinMapping: IPinInfo): IPinConfiguration {
      const supportedModes = [];

      // Serial and I2C are dedicated due to how the IO Plugin API works, so ignore all other supported peripheral types
      if (pinMapping.peripherals.indexOf(PeripheralType.UART) !== -1) {
        supportedModes.push(Mode.UNKNOWN);
      } else if (pinMapping.peripherals.indexOf(PeripheralType.I2C) !== -1) {
        supportedModes.push(Mode.UNKNOWN);
      } else {
        if (platform.led && pin === DEFAULT_LED_PIN) {
          supportedModes.push(Mode.OUTPUT);
        } else if (pinMapping.peripherals.indexOf(PeripheralType.GPIO) !== -1) {
          supportedModes.push(Mode.INPUT, Mode.OUTPUT);
        }
        if (pinMapping.peripherals.indexOf(PeripheralType.PWM) !== -1) {
          supportedModes.push(Mode.PWM, Mode.SERVO);
        }
      }
      return Object.create(null, {
        supportedModes: {
          enumerable: true,
          value: Object.freeze(supportedModes)
        },
        mode: {
          enumerable: true,
          get() {
            const peripheral = getPeripheral(pin);
            if (!peripheral) {
              return Mode.UNKNOWN;
            }
            return getMode(peripheral);
          }
        },
        value: {
          enumerable: true,
          get() {
            const peripheral = getPeripheral(pin);
            if (!peripheral) {
              return null;
            }
            switch (getMode(peripheral)) {
              case Mode.INPUT:
                return (peripheral as IDigitalInput).value;
              case Mode.OUTPUT:
                return (peripheral as IDigitalOutput).value;
              default:
                return null;
            }
          },
          set(value) {
            const peripheral = getPeripheral(pin);
            if (peripheral && getMode(peripheral) === Mode.OUTPUT) {
              (peripheral as IDigitalOutput).write(value);
            }
          }
        },
        report: {
          enumerable: true,
          value: 1
        },
        analogChannel: {
          enumerable: true,
          value: 127
        }
      });
    }

    for (const pinKey in pinMappings) {
      if (!pinMappings.hasOwnProperty(pinKey)) {
        continue;
      }
      const pin = parseInt(pinKey, 10);
      this[pins][pin] = createPinEntry(pin, pinMappings[pin]);
      if (this.supportsMode(pin, Mode.OUTPUT)) {
        this.pinMode(pin, Mode.OUTPUT);
        this.digitalWrite(pin, Value.LOW);
      }
    }

    // Add the virtual LED pin, since it's not a real pin, but only if a built-in LED is provided
    if (platform.led) {
      this[pins][DEFAULT_LED_PIN] = Object.create(null, {
        supportedModes: {
          enumerable: true,
          value: Object.freeze([ Mode.OUTPUT ])
        },
        mode: {
          enumerable: true,
          get() {
            return Mode.OUTPUT;
          }
        },
        value: {
          enumerable: true,
          get() {
            const ledManagerInstance = this[ledManager];
            if (ledManagerInstance) {
              return ledManagerInstance.getCurrentValue();
            } else {
              return Value.LOW;
            }
          }
        },
        report: {
          enumerable: true,
          value: 1
        },
        analogChannel: {
          enumerable: true,
          value: 127
        }
      });
    }

    // Fill in the holes, sins pins are sparse on some platforms, e.g. on most Raspberry Pis
    for (let i = 0; i < this[pins].length; i++) {
      if (!this[pins][i]) {
        this[pins][i] = Object.create(null, {
          supportedModes: {
            enumerable: true,
            value: Object.freeze([])
          },
          mode: {
            enumerable: true,
            get() {
              return Mode.UNKNOWN;
            }
          },
          value: {
            enumerable: true,
            get() {
              return 0;
            }
          },
          report: {
            enumerable: true,
            value: 1
          },
          analogChannel: {
            enumerable: true,
            value: 127
          }
        });
      }
    }

    platform.base.init(() => {
      if (platform.serial) {
        this.serialConfig({
          portId: this.SERIAL_PORT_IDs.DEFAULT,
          baud: 9600
        });
      }

      this[isReady] = true;
      this.emit('ready');
      this.emit('connect');
    });
  }

  public reset() {
    // TODO: Loop through active peripherals and destroy them
    // TODO: add unit tests for resetting
    this[gpioManager].reset();
    this[pwmManager].reset();
    const ledManagerInstance = this[ledManager];
    if (ledManagerInstance) {
      ledManagerInstance.reset();
    }
    const serialManagerInstance = this[serialManager];
    if (serialManagerInstance) {
      serialManagerInstance.reset();
    }
  }

  public normalize(pin: number | string): number {
    // LED is a special thing that the underlying platform doesn't know about, and isn't actually a pin.
    // Gotta reroute it here, and we just have it return the pin that's passed in
    if (this[ledManager] && pin === DEFAULT_LED_PIN) {
      return DEFAULT_LED_PIN;
    }
    return normalizePin(pin);
  }

  public pinMode(pin: string | number, mode: Mode): void {
    const normalizedPin = this.normalize(pin);

    // Make sure that the requested pin mode is valid and supported by the pin in question
    if (!Mode.hasOwnProperty(mode)) {
      throw new Error(`Unknown mode ${mode}`);
    }
    this.validateSupportedMode(pin, mode);

    if (this[ledManager] && pin === DEFAULT_LED_PIN) {
      // Note: the LED module is a dedicated peripheral and can't be any other mode, so we can shortcut here
      return;
    } else {
      switch (mode) {
        case Mode.INPUT:
          this[gpioManager].setInputMode(normalizedPin);
          break;
        case Mode.OUTPUT:
          this[gpioManager].setOutputMode(normalizedPin);
          break;
        case Mode.PWM:
          this[pwmManager].setPWMMode(normalizedPin);
          break;
        case Mode.SERVO:
          this[pwmManager].setServoMode(normalizedPin);
          break;
        default:
          throw new Error(createInternalErrorMessage(`valid pin mode ${mode} not accounted for in switch statement`));
      }
    }
  }

  // GPIO methods

  public digitalRead(pin: string | number, handler: (value: Value) => void): void {
    this.validateSupportedMode(pin, Mode.INPUT);
    this[gpioManager].digitalRead(this.normalize(pin), handler);
  }

  public digitalWrite(pin: string | number, value: number): void {
    // Again, LED is a special thing that the underlying platform doesn't know about.
    // Gotta reroute it here to the appropriate peripheral manager
    const ledManagerInstance = this[ledManager];
    if (ledManagerInstance && pin === DEFAULT_LED_PIN) {
      ledManagerInstance.digitalWrite(value);
    } else {
      // Gotta double check output support here, because this method can change the pin
      // mode but doesn't have full access to everything this file does
      this.validateSupportedMode(pin, Mode.OUTPUT);
      this[gpioManager].digitalWrite(this.normalize(pin), value);
    }
  }

  // PWM methods

  public pwmWrite(pin: string | number, value: number): void {
    this[pwmManager].pwmWrite(this.normalize(pin), value);
  }

  public servoWrite(pin: string | number, value: number): void {
    this[pwmManager].servoWrite(this.normalize(pin), value);
  }

  public servoConfig(options: IServoConfig): void;
  public servoConfig(pin: number | string, min: number, max: number): void;
  public servoConfig(optionsOrPin: IServoConfig | string | number, min?: number, max?: number): void {
    if (typeof optionsOrPin === 'number' || typeof optionsOrPin === 'string') {
      if (typeof min !== 'number') {
        throw new Error(`"min" must be a number`);
      }
      if (typeof max !== 'number') {
        throw new Error(`"max" must be a number`);
      }
    } else if (typeof optionsOrPin === 'object') {
      min = optionsOrPin.min;
      max = optionsOrPin.max;
      optionsOrPin = optionsOrPin.pin;
    } else {
      throw new Error('optionsOrPin must be a number, string, or object');
    }
    this[pwmManager].servoConfig(this.normalize(optionsOrPin), min, max);
  }

  // Serial Methods

  public serialConfig(options: ISerialConfig): void {
    const serialManagerInstance = this[serialManager];
    if (!serialManagerInstance) {
      throw new Error('Serial support is disabled');
    }
    serialManagerInstance.serialConfig(options);
  }

  public serialWrite(portId: string | number, inBytes: number[]): void {
    const serialManagerInstance = this[serialManager];
    if (!serialManagerInstance) {
      throw new Error('Serial support is disabled');
    }
    serialManagerInstance.serialWrite(portId, inBytes);
  }

  public serialRead(
    portId: number | string,
    handler: Handler<number[]>
  ): void;
  public serialRead(
    portId: number | string,
    maxBytesToRead: number,
    handler: Handler<number[]>
  ): void;
  public serialRead(
    portId: number | string,
    maxBytesToReadOrHandler: Handler<number[]> | number,
    handler?: Handler<number[]>
  ): void {
    const serialManagerInstance = this[serialManager];
    if (!serialManagerInstance) {
      throw new Error('Serial support is disabled');
    }
    serialManagerInstance.serialRead(portId, maxBytesToReadOrHandler, handler);
  }

  public serialStop(portId: number | string): void {
    const serialManagerInstance = this[serialManager];
    if (!serialManagerInstance) {
      throw new Error('Serial support is disabled');
    }
    serialManagerInstance.serialStop(portId);
  }

  public serialClose(portId: number | string): void {
    const serialManagerInstance = this[serialManager];
    if (!serialManagerInstance) {
      throw new Error('Serial support is disabled');
    }
    serialManagerInstance.serialClose(portId);
  }

  public serialFlush(portId: number | string): void {
    const serialManagerInstance = this[serialManager];
    if (!serialManagerInstance) {
      throw new Error('Serial support is disabled');
    }
    serialManagerInstance.serialFlush(portId);
  }

  // I2C Methods

  public i2cConfig(options: II2CConfig): void {
    // Do nothing because we don't currently support delay
  }

  public i2cWrite(address: number, register: number): void;
  public i2cWrite(address: number, inBytes: number[]): void;
  public i2cWrite(address: number, register: number, inBytes: number[]): void;
  public i2cWrite(address: number, registerOrInBytes: number | number[], inBytes?: number[]): void {
    const i2cManagerInstance = this[i2cManager];
    if (!i2cManagerInstance) {
      throw new Error('I2C support is disabled');
    }
    let value: number[];
    let register: number | undefined;
    if (typeof registerOrInBytes === 'number' && Array.isArray(inBytes)) {
      register = registerOrInBytes;
      value = inBytes;
    } else if (typeof registerOrInBytes === 'number' && typeof inBytes === 'undefined') {
      register = registerOrInBytes;
      value = [];
    } else if (Array.isArray(registerOrInBytes)) {
      register = undefined;
      value = registerOrInBytes;
    } else {
      throw new Error('Invalid arguments');
    }

    // Skip the write if the buffer is empty
    if (value.length) {
      i2cManagerInstance.i2cWrite(this[i2cPortIds].DEFAULT, address, register, value);
    }
  }

  public i2cWriteReg(address: number, register: number, value: number): void {
    const i2cManagerInstance = this[i2cManager];
    if (!i2cManagerInstance) {
      throw new Error('I2C support is disabled');
    }
    i2cManagerInstance.i2cWrite(this[i2cPortIds].DEFAULT, address, register, value);
  }

  public i2cRead(
    address: number,
    bytesToRead: number,
    handler: Handler<number[]>
  ): void;
  public i2cRead(
    address: number,
    register: number,
    bytesToRead: number,
    handler: Handler<number[]>
  ): void;
  public i2cRead(
    inAddress: number,
    registerOrBytesToRead: number,
    bytesToReadOrHandler: Handler<number[]> | number,
    inHandler?: Handler<number[]>
): void {
  const i2cManagerInstance = this[i2cManager];
  if (!i2cManagerInstance) {
    throw new Error('I2C support is disabled');
  }
  const { address, register, bytesToRead, handler } =
    this[swizzleI2CReadArguments](inAddress, registerOrBytesToRead, bytesToReadOrHandler, inHandler);
  i2cManagerInstance.i2cRead(this[i2cPortIds].DEFAULT, true, address, register, bytesToRead, handler);
  }

  public i2cReadOnce(
    address: number,
    bytesToRead: number,
    handler: Handler<number[]>
  ): void;
  public i2cReadOnce(
    address: number,
    register: number,
    bytesToRead: number,
    handler: Handler<number[]>
  ): void;
  public i2cReadOnce(
    inAddress: number,
    registerOrBytesToRead: number,
    bytesToReadOrHandler: Handler<number[]> | number,
    inHandler?: Handler<number[]>
  ): void {
    const i2cManagerInstance = this[i2cManager];
    if (!i2cManagerInstance) {
      throw new Error('I2C support is disabled');
    }
    const { address, register, bytesToRead, handler } =
      this[swizzleI2CReadArguments](inAddress, registerOrBytesToRead, bytesToReadOrHandler, inHandler);
    i2cManagerInstance.i2cRead(this[i2cPortIds].DEFAULT, false, address, register, bytesToRead, handler);
  }

  private [swizzleI2CReadArguments](
    address: number,
    registerOrBytesToRead: number,
    bytesToReadOrHandler: Handler<number[]> | number,
    handler?: Handler<number[]>
  ): { address: number, register: number | undefined, bytesToRead: number, handler: Handler<number[]> } {
    let register: number | undefined;
    let bytesToRead: number;
    if (typeof handler === 'function' && typeof bytesToReadOrHandler === 'number') {
      register = registerOrBytesToRead;
      bytesToRead = bytesToReadOrHandler;
    } else if (typeof bytesToReadOrHandler === 'function' && typeof handler === 'undefined') {
      bytesToRead = registerOrBytesToRead;
      handler = bytesToReadOrHandler;
    } else {
      throw new Error('Invalid arguments');
    }
    if (typeof handler !== 'function') {
      handler = () => {
        // Do nothing
      };
    }
    return { address, register, bytesToRead, handler };
  }

  private supportsMode(normalizedPin: number, mode: Mode): boolean {
    return this[pins][normalizedPin].supportedModes.indexOf(mode) !== -1;
  }

  private validateSupportedMode(pin: string | number, mode: Mode): void {
    const normalizedPin = this.normalize(pin);
    if (!this.supportsMode(normalizedPin, mode)) {
      throw new Error(`Pin "${pin}" does not support mode "${Mode[mode].toLowerCase()}"`);
    }
  }
}
