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
  IGPIOModule,
  ILEDModule,
  IPWMModule,
  ISerialModule,
  II2CModule
} from 'core-io-types';
import { AbstractIO, Value, Mode } from 'abstract-io';

import { setBaseModule, normalizePin } from './core';
import { GPIOManager } from './managers/gpio';

// Constants

const LED_PIN = -1;

const SOFTWARE_PWM_RANGE = 1000;
const SOFTWARE_PWM_FREQUENCY = 50;

// Settings
const DEFAULT_SERVO_MIN = 1000;
const DEFAULT_SERVO_MAX = 2000;

// Private symbols
const gpioManager = Symbol('gpioManager');

// Old Private symbols
const isReady = Symbol('isReady');
const pins = Symbol('pins');
const instances = Symbol('instances');
const analogPins = Symbol('analogPins');
const getPinInstance = Symbol('getPinInstance');
const i2c = Symbol('i2c');
const i2cDelay = Symbol('i2cDelay');
const i2cRead = Symbol('i2cRead');
const i2cCheckAlive = Symbol('i2cCheckAlive');
const pinMode = Symbol('pinMode');
const serial = Symbol('serial');
const serialQueue = Symbol('serialQueue');
const addToSerialQueue = Symbol('addToSerialQueue');
const serialPump = Symbol('serialPump');
const isSerialProcessing = Symbol('isSerialProcessing');
const isSerialOpen = Symbol('isSerialOpen');

const raspiModule = Symbol('raspiModule');
const raspiBoardModule = Symbol('raspiBoardModule');
const raspiGpioModule = Symbol('raspiGpioModule');
const raspiI2cModule = Symbol('raspiI2cModule');
const raspiLedModule = Symbol('raspiLedModule');
const raspiPwmModule = Symbol('raspiPwmModule');
const raspiSerialModule = Symbol('raspiSerialModule');
const raspiSoftPwmModule = Symbol('raspiSoftPwmModule');

const SERIAL_ACTION_WRITE = 'SERIAL_ACTION_WRITE';
const SERIAL_ACTION_CLOSE = 'SERIAL_ACTION_CLOSE';
const SERIAL_ACTION_FLUSH = 'SERIAL_ACTION_FLUSH';
const SERIAL_ACTION_CONFIG = 'SERIAL_ACTION_CONFIG';
const SERIAL_ACTION_READ = 'SERIAL_ACTION_READ';
const SERIAL_ACTION_STOP = 'SERIAL_ACTION_STOP';

function constrain(value: number, min: number, max: number): number {
  return value > max ? max : value < min ? min : value;
}

export interface IOptions {
  includePins?: Array<number | string>;
  excludePins?: Array<number | string>;
  // TODO: add peripheral map here
  platform: {
    base: IBaseModule,
    gpio: IGPIOModule,
    pwm: IPWMModule,
    led?: ILEDModule,
    serial?: ISerialModule,
    i2c?: II2CModule
  }
}

export class CoreIO extends AbstractIO {

  private [gpioManager]: GPIOManager;

  public readonly defaultLed = LED_PIN;
  public readonly name = 'Raspi IO';

  constructor(options: IOptions) {
    super();

    if (typeof options !== 'object') {
      throw new Error('An options object is required');
    }
    const { includePins, excludePins, platform } = options;

    if (!platform || typeof platform !== 'object') {
      throw new Error('"platform" option is required and must be an object');
    }
    if (!platform.base) {
      throw new Error('"base" module is missing from "platform" option');
    }
    if (!platform.gpio) {
      throw new Error('"gpio" module is missing from "platform" option');
    }
    if (!platform.pwm) {
      throw new Error('"pwm" module is missing from "platform" option');
    }

    if (includePins && excludePins) {
      throw new Error('"includePins" and "excludePins" cannot be specified at the same time');
    }

    setBaseModule(platform.base);
    this[gpioManager] = new GPIOManager(platform.gpio, this);

    Object.defineProperties(this, {

      [instances]: {
        writable: true,
        value: []
      },

      [isReady]: {
        writable: true,
        value: false
      },
      isReady: {
        enumerable: true,
        get() {
          return this[isReady];
        }
      },

      [pins]: {
        writable: true,
        value: []
      },
      pins: {
        enumerable: true,
        get() {
          return this[pins];
        }
      },

      [analogPins]: {
        writable: true,
        value: []
      },
      analogPins: {
        enumerable: true,
        get() {
          return this[analogPins];
        }
      },

      [i2c]: {
        writable: true,
        value: new this[raspiI2cModule].I2C()
      },

      [i2cDelay]: {
        writable: true,
        value: 0
      },

      [serialQueue]: {
        value: []
      },

      [isSerialProcessing]: {
        writable: true,
        value: false
      },

      [isSerialOpen]: {
        writable: true,
        value: false
      },
    });

    if (enableSerial) {
      Object.defineProperties(this, {

        [raspiSerialModule]: {
          writable: true,
          value: platform['raspi-serial']
        },

        [serial]: {
          writable: true,
          value: new this[raspiSerialModule].Serial()
        },

        SERIAL_PORT_IDs: {
          enumerable: true,
          value: Object.freeze({
            HW_SERIAL0: this[raspiSerialModule].DEFAULT_PORT,
            DEFAULT: this[raspiSerialModule].DEFAULT_PORT
          })
        }

      });
    } else {
      Object.defineProperties(this, {

        SERIAL_PORT_IDs: {
          enumerable: true,
          value: Object.freeze({})
        }

      });
    }

    if (process.env['RASPI_IO_TEST_MODE']) {
      this.getInternalPinInstances = () => this[instances];
      this.getI2CInstance = () => this[i2c];
    }

    this[raspiModule].init(() => {
      let pinMappings = this[raspiBoardModule].getPins();
      this[pins] = [];

      // Slight hack to get the LED in there, since it's not actually a pin
      pinMappings[LED_PIN] = {
        pins: [ LED_PIN ],
        peripherals: [ 'gpio' ]
      };

      if (Array.isArray(includePins)) {
        const newPinMappings = {};
        for (const pin of includePins) {
          const normalizedPin = this[raspiBoardModule].getPinNumber(pin);
          if (normalizedPin === null) {
            throw new Error(`Invalid pin "${pin}" specified in includePins`);
          }
          newPinMappings[normalizedPin] = pinMappings[normalizedPin];
        }
        pinMappings = newPinMappings;
      } else if (Array.isArray(excludePins)) {
        pinMappings = Object.assign({}, pinMappings);
        for (const pin of excludePins) {
          const normalizedPin = this[raspiBoardModule].getPinNumber(pin);
          if (normalizedPin === null) {
            throw new Error(`Invalid pin "${pin}" specified in excludePins`);
          }
          delete pinMappings[normalizedPin];
        }
      }

      Object.keys(pinMappings).forEach((pin) => {
        const pinInfo = pinMappings[pin];
        const supportedModes = [];
        // We don't want I2C to be used for anything else, since changing the
        // pin mode makes it unable to ever do I2C again.
        if (pinInfo.peripherals.indexOf('i2c') == -1 && pinInfo.peripherals.indexOf('uart') == -1) {
          if (pin == LED_PIN) {
            supportedModes.push(OUTPUT_MODE);
          } else if (pinInfo.peripherals.indexOf('gpio') != -1) {
            supportedModes.push(INPUT_MODE, OUTPUT_MODE);
          }
          if (pinInfo.peripherals.indexOf('pwm') != -1) {
            supportedModes.push(PWM_MODE, SERVO_MODE);
          } else if (enableSoftPwm === true && pinInfo.peripherals.indexOf('gpio') !== -1) {
            supportedModes.push(PWM_MODE, SERVO_MODE);
          }
        }
        const instance = this[instances][pin] = {
          peripheral: null,
          mode: supportedModes.indexOf(OUTPUT_MODE) == -1 ? UNKNOWN_MODE : OUTPUT_MODE,

          // Used to cache the previously written value for reading back in OUTPUT mode
          // We start with undefined because it's in an unknown state
          previousWrittenValue: undefined,

          // For comparing previous digital reads, as to only trigger event on change
          previousReadValue: undefined,

          // Used to set the default min and max values
          min: DEFAULT_SERVO_MIN,
          max: DEFAULT_SERVO_MAX,

          // Used to track if this pin is capable of hardware PWM
          isHardwarePwm: pinInfo.peripherals.indexOf('pwm') !== -1
        };
        this[pins][pin] = Object.create(null, {
          supportedModes: {
            enumerable: true,
            value: Object.freeze(supportedModes)
          },
          mode: {
            enumerable: true,
            get() {
              return instance.mode;
            }
          },
          value: {
            enumerable: true,
            get() {
              switch (instance.mode) {
                case INPUT_MODE:
                  return instance.peripheral.read();
                case OUTPUT_MODE:
                  return instance.previousWrittenValue;
                default:
                  return null;
              }
            },
            set(value) {
              if (instance.mode == OUTPUT_MODE) {
                instance.peripheral.write(value);
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
        if (instance.mode == OUTPUT_MODE) {
          this.pinMode(pin, OUTPUT_MODE);
          this.digitalWrite(pin, LOW);
        }
      });

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
                return UNKNOWN_MODE;
              }
            },
            value: {
              enumerable: true,
              get() {
                return 0;
              },
              set() {}
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

      if (enableSerial) {
        this.serialConfig({
          portId: this[raspiSerialModule].DEFAULT_PORT,
          baud: 9600
        });
      }

      this[isReady] = true;
      this.emit('ready');
      this.emit('connect');
    });
  }

  public normalize(pin: number | string): number {
    return normalizePin(pin);
  }

  pinMode(pin, mode) {
    this[pinMode]({ pin, mode });
  }

  [getPinInstance](pin) {
    const pinInstance = this[instances][pin];
    if (!pinInstance) {
      throw new Error(`Unknown pin "${pin}"`);
    }
    return pinInstance;
  }

  [pinMode]({ pin, mode, pullResistor = this[raspiGpioModule].PULL_NONE }) {
    const normalizedPin = this.normalize(pin);
    const pinInstance = this[getPinInstance](normalizedPin);
    pinInstance.pullResistor = pullResistor;
    const config = {
      pin: normalizedPin,
      pullResistor: pinInstance.pullResistor
    };
    if (this[pins][normalizedPin].supportedModes.indexOf(mode) == -1) {
      let modeName;
      switch(mode) {
        case INPUT_MODE: modeName = 'input'; break;
        case OUTPUT_MODE: modeName = 'output'; break;
        case ANALOG_MODE: modeName = 'analog'; break;
        case PWM_MODE: modeName = 'pwm'; break;
        case SERVO_MODE: modeName = 'servo'; break;
        default: modeName = 'other'; break;
      }
      throw new Error(`Pin "${pin}" does not support mode "${modeName}"`);
    }

    if (pin == LED_PIN) {
      if (pinInstance.peripheral instanceof this[raspiLedModule].LED) {
        return;
      }
      pinInstance.peripheral = new this[raspiLedModule].LED();
    } else {
      switch (mode) {
        case INPUT_MODE:
          pinInstance.peripheral = new this[raspiGpioModule].DigitalInput(config);
          break;
        case OUTPUT_MODE:
          pinInstance.peripheral = new this[raspiGpioModule].DigitalOutput(config);
          break;
        case PWM_MODE:
        case SERVO_MODE:
          if (pinInstance.isHardwarePwm) {
            pinInstance.peripheral = new this[raspiPwmModule].PWM(normalizedPin);
          } else {
            pinInstance.peripheral = new this[raspiSoftPwmModule].SoftPWM({
              pin: normalizedPin,
              frequency: SOFTWARE_PWM_FREQUENCY,
              range: SOFTWARE_PWM_RANGE
            });
          }
          break;
        default:
          console.warn(`Unknown pin mode: ${mode}`); // eslint-disable-line no-console
          break;
      }
    }
    pinInstance.mode = mode;
  }

  // GPIO methods

  public digitalRead(pin: string | number, handler: (value: Value) => void): void {
    this[gpioManager].digitalRead(this.normalize(pin), handler);
  }

  public digitalWrite(pin: string | number, value: number): void {
    this[gpioManager].digitalWrite(this.normalize(pin), value);
  }

  // Methods that need converting

  // analogRead() {
  //   throw new Error('analogRead is not supported on the Raspberry Pi');
  // }

  // analogWrite(pin, value) {
  //   this.pwmWrite(pin, value);
  // }

  // pwmWrite(pin, value) {
  //   const pinInstance = this[getPinInstance](this.normalize(pin));
  //   if (pinInstance.mode != PWM_MODE) {
  //     this.pinMode(pin, PWM_MODE);
  //   }
  //   // TODO: need to constrain value to be between 0 and 255
  //   pinInstance.peripheral.write(value / 255);
  // }

  // servoConfig(pin, min, max) {
  //   let config = pin;
  //   if (typeof config !== 'object') {
  //     config = { pin, min, max };
  //   }
  //   if (typeof config.min !== 'number') {
  //     config.min = DEFAULT_SERVO_MIN;
  //   }
  //   if (typeof config.max !== 'number') {
  //     config.max = DEFAULT_SERVO_MAX;
  //   }
  //   const normalizedPin = this.normalize(pin);
  //   let pinInstance = this[getPinInstance](this.normalize(normalizedPin));
  //   if (pinInstance.mode != SERVO_MODE) {
  //     this.pinMode(pin, SERVO_MODE);
  //     pinInstance = this[getPinInstance](this.normalize(normalizedPin));
  //   }
  //   pinInstance.min = config.min;
  //   pinInstance.max = config.max;
  // }

  // servoWrite(pin, value) {
  //   const pinInstance = this[getPinInstance](this.normalize(pin));
  //   if (pinInstance.mode != SERVO_MODE) {
  //     this.pinMode(pin, SERVO_MODE);
  //   }
  //   const period = 1000000 / pinInstance.peripheral.frequency; // in us
  //   var pulseWidth;
  //   if (value < 544) {
  //     pulseWidth = pinInstance.min + constrain(value, 0, 180) / 180 * (pinInstance.max - pinInstance.min);
  //   } else {
  //     pulseWidth = constrain(value, pinInstance.min, pinInstance.max);
  //   }
  //   pinInstance.peripheral.write(pulseWidth / period);
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
