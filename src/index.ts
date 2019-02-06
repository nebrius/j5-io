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
} from 'core-io-types';
import { AbstractIO, Value, Mode, IPinConfiguration, ISerialConfig, IServoConfig } from 'abstract-io';
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

// Private symbols for public getters
const serialPortIds = Symbol('serialPortIds');
const name = Symbol('name');
const isReady = Symbol('isReady');
const pins = Symbol('pins');
const defaultLed = Symbol('defaultLed');

// Private symbols for internal properties
const gpioManager = Symbol('gpioManager');
const pwmManager = Symbol('pwmManager');
const ledManager = Symbol('ledManager');

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
  pinInfo: { [ pin: number ]: IPinInfo };
}

export class CoreIO extends AbstractIO {

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
  public getI2CInstance?: () => II2C | undefined;
  public getLEDInstance?: () => ILED | undefined;

  private [serialPortIds]: { [ id: string ]: any };
  private [isReady] = false;
  private [pins]: IPinConfiguration[] = [];
  private [name]: string;
  private [defaultLed]: number | undefined;

  private [gpioManager]: GPIOManager;
  private [pwmManager]: PWMManager;
  private [ledManager]?: LEDManager;

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

    // Create the plugin name
    this[name] = options.pluginName;

    const { pinInfo, serialIds, platform } = options;

    // Create the serial port IDs if serial is supported
    if (serialIds) {
      this[serialPortIds] = Object.freeze(serialIds);
    } else {
      this[serialPortIds] = Object.freeze({});
    }

    // Instantiate the peripheral managers
    setBaseModule(platform.base);
    this[gpioManager] = new GPIOManager(platform.gpio, this);
    this[pwmManager] = new PWMManager(platform.pwm);
    if (platform.led) {
      this[defaultLed] = DEFAULT_LED_PIN;
      this[ledManager] = new LEDManager(platform.led);
    }

    // Inject the test only methods if we're in test mode
    if (process.env.RASPI_IO_TEST_MODE) {
      this.getInternalPinInstances = () => getPeripherals();
      this.getLEDInstance = () => this[ledManager] && (this[ledManager] as LEDManager).led;
      // TODO:
      // this.getI2CInstance = () => this[i2c];
    }

    // Create the pins object
    this[pins] = [];
    const pinMappings = { ...pinInfo };

    function createPinEntry(pin: number, pinMapping: IPinInfo): IPinConfiguration {
      const supportedModes = [];
      if (platform.led && pin === DEFAULT_LED_PIN) {
        supportedModes.push(Mode.OUTPUT);
      } else if (pinMapping.peripherals.indexOf(PeripheralType.GPIO) !== -1) {
        supportedModes.push(Mode.INPUT, Mode.OUTPUT);
      }
      if (pinMapping.peripherals.indexOf(PeripheralType.PWM) !== -1) {
        supportedModes.push(Mode.PWM, Mode.SERVO);
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
              return Mode.UNKOWN;
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
      if (this[pins][pin].supportedModes.indexOf(Mode.OUTPUT) !== -1) {
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

    // Fill in the holes, sins pins are sparse on the A+/B+/2
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
              return Mode.UNKOWN;
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
    this[gpioManager].reset();
    const ledManagerInstance = this[ledManager];
    if (ledManagerInstance) {
      ledManagerInstance.reset();
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
    } else if (this[pins][normalizedPin].supportedModes.indexOf(mode) === -1) {
      throw new Error(`Pin "${pin}" does not support mode "${Mode[mode].toLowerCase()}"`);
    }

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
    this[gpioManager].digitalRead(this.normalize(pin), handler);
  }

  public digitalWrite(pin: string | number, value: number): void {
    // Again, LED is a special thing that the underlying platform doesn't know about.
    // Gotta reroute it here to the appropriate peripheral manager
    const ledManagerInstance = this[ledManager];
    if (ledManagerInstance && pin === DEFAULT_LED_PIN) {
      ledManagerInstance.digitalWrite(value);
    } else {
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

  // Methods that need converting

  // analogRead() {
  //   throw new Error('analogRead is not supported on the Raspberry Pi');
  // }

  // queryCapabilities(cb) {
  //   if (this.isReady) {
  //     process.nextTick(cb);
  //   } else {
  //     this.on('ready', cb);
  //   }
  // }

  // queryAnalogMapping(cb) {
  //   if (this.isReady) {
  //     process.nextTick(cb);
  //   } else {
  //     this.on('ready', cb);
  //   }
  // }

  // queryPinState(pin, cb) {
  //   if (this.isReady) {
  //     process.nextTick(cb);
  //   } else {
  //     this.on('ready', cb);
  //   }
  // }

  // [i2cCheckAlive]() {
  //   if (!this[i2c].alive) {
  //     throw new Error('I2C pins not in I2C mode');
  //   }
  // }

  // i2cConfig(options) {
  //   let delay;

  //   if (typeof options === 'number') {
  //     delay = options;
  //   } else {
  //     if (typeof options === 'object' && options !== null) {
  //       delay = options.delay;
  //     }
  //   }

  //   this[i2cCheckAlive]();

  //   this[i2cDelay] = Math.round((delay || 0) / 1000);

  //   return this;
  // }

  // i2cWrite(address, cmdRegOrData, inBytes) {
  //   this[i2cCheckAlive]();

  //   // If i2cWrite was used for an i2cWriteReg call...
  //   if (arguments.length === 3 &&
  //       !Array.isArray(cmdRegOrData) &&
  //       !Array.isArray(inBytes)) {
  //     return this.i2cWriteReg(address, cmdRegOrData, inBytes);
  //   }

  //   // Fix arguments if called with Firmata.js API
  //   if (arguments.length === 2) {
  //     if (Array.isArray(cmdRegOrData)) {
  //       inBytes = cmdRegOrData.slice();
  //       cmdRegOrData = inBytes.shift();
  //     } else {
  //       inBytes = [];
  //     }
  //   }

  //   const buffer = new Buffer([cmdRegOrData].concat(inBytes));

  //   // Only write if bytes provided
  //   if (buffer.length) {
  //     this[i2c].writeSync(address, buffer);
  //   }

  //   return this;
  // }

  // i2cWriteReg(address, register, value) {
  //   this[i2cCheckAlive]();

  //   this[i2c].writeByteSync(address, register, value);

  //   return this;
  // }

  // [i2cRead](continuous, address, register, bytesToRead, callback) {
  //   this[i2cCheckAlive]();

  //   // Fix arguments if called with Firmata.js API
  //   if (arguments.length == 4 &&
  //     typeof register == 'number' &&
  //     typeof bytesToRead == 'function'
  //   ) {
  //     callback = bytesToRead;
  //     bytesToRead = register;
  //     register = null;
  //   }

  //   callback = typeof callback === 'function' ? callback : () => {};

  //   let event = `i2c-reply-${address}-`;
  //   event += register !== null ? register : 0;

  //   const read = () => {
  //     const afterRead = (err, buffer) => {
  //       if (err) {
  //         return this.emit('error', err);
  //       }

  //       // Convert buffer to Array before emit
  //       this.emit(event, Array.prototype.slice.call(buffer));

  //       if (continuous && this[i2c].alive) {
  //         setTimeout(read, this[i2cDelay]);
  //       }
  //     };

  //     this.once(event, callback);

  //     if (register !== null) {
  //       this[i2c].read(address, register, bytesToRead, afterRead);
  //     } else {
  //       this[i2c].read(address, bytesToRead, afterRead);
  //     }
  //   };

  //   setTimeout(read, this[i2cDelay]);

  //   return this;
  // }

  // i2cRead(...rest) {
  //   return this[i2cRead](true, ...rest);
  // }

  // i2cReadOnce(...rest) {
  //   return this[i2cRead](false, ...rest);
  // }

  // sendI2CConfig(...rest) {
  //   return this.i2cConfig(...rest);
  // }

  // sendI2CWriteRequest(...rest) {
  //   return this.i2cWrite(...rest);
  // }

  // sendI2CReadRequest(...rest) {
  //   return this.i2cReadOnce(...rest);
  // }

  public serialConfig(options: ISerialConfig): void {
    // TODO
  }

  // // TODO: print a warning or throw an error (?) when rxPin or txPin are specified
  // serialConfig({ portId, baud }) {
  //   if (!this[raspiSerialModule]) {
  //     throw new Error('Serial support is disabled');
  //   }
  //   if (!portId) {
  //     throw new Error('"portId" parameter missing in options');
  //   }
  //   if (!this[isSerialOpen] || (baud && baud !== this[serial].baudRate)) {
  //     this[addToSerialQueue]({
  //       type: SERIAL_ACTION_CONFIG,
  //       portId,
  //       baud
  //     });
  //   }
  // }

  // serialWrite(portId, inBytes) {
  //   if (!this[raspiSerialModule]) {
  //     throw new Error('Serial support is disabled');
  //   }
  //   if (!portId) {
  //     throw new Error('"portId" argument missing');
  //   }
  //   this[addToSerialQueue]({
  //     type: SERIAL_ACTION_WRITE,
  //     portId,
  //     inBytes
  //   });
  // }

  // serialRead(portId, maxBytesToRead, handler) {
  //   if (!this[raspiSerialModule]) {
  //     throw new Error('Serial support is disabled');
  //   }
  //   if (!portId) {
  //     throw new Error('"portId" argument missing');
  //   }
  //   if (typeof maxBytesToRead === 'function') {
  //     handler = maxBytesToRead;
  //     maxBytesToRead = undefined;
  //   }
  //   this[addToSerialQueue]({
  //     type: SERIAL_ACTION_READ,
  //     portId,
  //     maxBytesToRead,
  //     handler
  //   });
  // }

  // serialStop(portId) {
  //   if (!this[raspiSerialModule]) {
  //     throw new Error('Serial support is disabled');
  //   }
  //   if (!portId) {
  //     throw new Error('"portId" argument missing');
  //   }
  //   this[addToSerialQueue]({
  //     type: SERIAL_ACTION_STOP,
  //     portId
  //   });
  // }

  // serialClose(portId) {
  //   if (!this[raspiSerialModule]) {
  //     throw new Error('Serial support is disabled');
  //   }
  //   if (!portId) {
  //     throw new Error('"portId" argument missing');
  //   }
  //   this[addToSerialQueue]({
  //     type: SERIAL_ACTION_CLOSE,
  //     portId
  //   });
  // }

  // serialFlush(portId) {
  //   if (!this[raspiSerialModule]) {
  //     throw new Error('Serial support is disabled');
  //   }
  //   if (!portId) {
  //     throw new Error('"portId" argument missing');
  //   }
  //   this[addToSerialQueue]({
  //     type: SERIAL_ACTION_FLUSH,
  //     portId
  //   });
  // }

  // [addToSerialQueue](action) {
  //   if (action.portId !== this[raspiSerialModule].DEFAULT_PORT) {
  //     throw new Error(`Invalid serial port "${action.portId}"`);
  //   }
  //   this[serialQueue].push(action);
  //   this[serialPump]();
  // }

  // [serialPump]() {
  //   if (this[isSerialProcessing] || !this[serialQueue].length) {
  //     return;
  //   }
  //   this[isSerialProcessing] = true;
  //   const action = this[serialQueue].shift();
  //   const finalize = () => {
  //     this[isSerialProcessing] = false;
  //     this[serialPump]();
  //   };
  //   switch (action.type) {
  //     case SERIAL_ACTION_WRITE:
  //       if (!this[isSerialOpen]) {
  //         throw new Error('Cannot write to closed serial port');
  //       }
  //       this[serial].write(action.inBytes, finalize);
  //       break;

  //     case SERIAL_ACTION_READ:
  //       if (!this[isSerialOpen]) {
  //         throw new Error('Cannot read from closed serial port');
  //       }
  //       // TODO: add support for action.maxBytesToRead
  //       this[serial].on('data', (data) => {
  //         action.handler(bufferToArray(data));
  //       });
  //       process.nextTick(finalize);
  //       break;

  //     case SERIAL_ACTION_STOP:
  //       if (!this[isSerialOpen]) {
  //         throw new Error('Cannot stop closed serial port');
  //       }
  //       this[serial].removeAllListeners();
  //       process.nextTick(finalize);
  //       break;

  //     case SERIAL_ACTION_CONFIG:
  //       this[serial].close(() => {
  //         this[serial] = new this[raspiSerialModule].Serial({
  //           baudRate: action.baud
  //         });
  //         if (process.env['RASPI_IO_TEST_MODE']) {
  //           this.emit('$TEST_MODE-serial-instance-created', this[serial]);
  //         }
  //         this[serial].open(() => {
  //           this[serial].on('data', (data) => {
  //             this.emit(`serial-data-${action.portId}`, bufferToArray(data));
  //           });
  //           this[isSerialOpen] = true;
  //           finalize();
  //         });
  //       });
  //       break;

  //     case SERIAL_ACTION_CLOSE:
  //       this[serial].close(() => {
  //         this[isSerialOpen] = false;
  //         finalize();
  //       });
  //       break;

  //     case SERIAL_ACTION_FLUSH:
  //       if (!this[isSerialOpen]) {
  //         throw new Error('Cannot flush closed serial port');
  //       }
  //       this[serial].flush(finalize);
  //       break;

  //     default:
  //       throw new Error('Internal error: unknown serial action type');
  //   }
  // }
}
