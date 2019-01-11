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
  II2CModule,
  IPeripheral,
  IDigitalInput,
  IDigitalOutput,
  IPinInfo,
  PeripheralType
} from 'core-io-types';
import { AbstractIO, Value, Mode, IPinConfiguration } from 'abstract-io';
import { setBaseModule, normalizePin, getPeripherals, getMode, getPeripheral } from './core';

import { GPIOManager } from './managers/gpio';

// Constants
const LED_PIN = -1;

// Private symbols for public getters
const serialPortIds = Symbol('serialPortIds');
const name = Symbol('name');
const isReady = Symbol('isReady');
const pins = Symbol('pins');

// Private symbols for internal properties
const gpioManager = Symbol('gpioManager');

// Old Constants
// const SOFTWARE_PWM_RANGE = 1000;
// const SOFTWARE_PWM_FREQUENCY = 50;

// Old Settings
// const DEFAULT_SERVO_MIN = 1000;
// const DEFAULT_SERVO_MAX = 2000;

// Old Private symbols
// const instances = Symbol('instances');
// const analogPins = Symbol('analogPins');
// const getPinInstance = Symbol('getPinInstance');
// const i2c = Symbol('i2c');
// const i2cDelay = Symbol('i2cDelay');
// const i2cRead = Symbol('i2cRead');
// const i2cCheckAlive = Symbol('i2cCheckAlive');
// const pinMode = Symbol('pinMode');
// const serial = Symbol('serial');
// const serialQueue = Symbol('serialQueue');
// const addToSerialQueue = Symbol('addToSerialQueue');
// const serialPump = Symbol('serialPump');
// const isSerialProcessing = Symbol('isSerialProcessing');
// const isSerialOpen = Symbol('isSerialOpen');

// const raspiModule = Symbol('raspiModule');
// const raspiBoardModule = Symbol('raspiBoardModule');
// const raspiGpioModule = Symbol('raspiGpioModule');
// const raspiI2cModule = Symbol('raspiI2cModule');
// const raspiLedModule = Symbol('raspiLedModule');
// const raspiPwmModule = Symbol('raspiPwmModule');
// const raspiSerialModule = Symbol('raspiSerialModule');
// const raspiSoftPwmModule = Symbol('raspiSoftPwmModule');

// const SERIAL_ACTION_WRITE = 'SERIAL_ACTION_WRITE';
// const SERIAL_ACTION_CLOSE = 'SERIAL_ACTION_CLOSE';
// const SERIAL_ACTION_FLUSH = 'SERIAL_ACTION_FLUSH';
// const SERIAL_ACTION_CONFIG = 'SERIAL_ACTION_CONFIG';
// const SERIAL_ACTION_READ = 'SERIAL_ACTION_READ';
// const SERIAL_ACTION_STOP = 'SERIAL_ACTION_STOP';

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
  pinInfo: { [ pin: number ]: IPinInfo };
}

export class CoreIO extends AbstractIO {

  public get defaultLed() {
    return LED_PIN;
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
  public getI2CInstance?: () => void;

  private [serialPortIds]: { [ id: string ]: any };
  private [isReady] = false;
  private [pins]: IPinConfiguration[] = [];
  private [name]: string;

  private [gpioManager]: GPIOManager;

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

    // Create the plugin name
    this[name] = options.pluginName;

    const { pinInfo, platform } = options;

    // Create the serial port IDs if serial is supported
    if (platform.serial) {
      // TODO: Add these in...where to get them from though?
      this[serialPortIds] = Object.freeze({
      });
    } else {
      this[serialPortIds] = Object.freeze({});
    }

    // Instantiate the peripheral managers
    setBaseModule(platform.base);
    this[gpioManager] = new GPIOManager(platform.gpio, this);

    // Inject the test only methods if we're in test mode
    if (process.env.RASPI_IO_TEST_MODE) {
      this.getInternalPinInstances = () => getPeripherals();
      // TODO:
      // this.getI2CInstance = () => this[i2c];
    }

    // Create the pins object
    this[pins] = [];
    const pinMappings = { ...pinInfo };

    // Slight hack to get the LED in there, since it's not actually a pin
    pinMappings[LED_PIN] = {
      pins: [ LED_PIN.toString() ],
      peripherals: [ PeripheralType.GPIO ]
    };

    // TODO: Move to raspi-io
    // if (Array.isArray(includePins)) {
    //   const newPinMappings = {};
    //   for (const pin of includePins) {
    //     const normalizedPin = this[raspiBoardModule].getPinNumber(pin);
    //     if (normalizedPin === null) {
    //       throw new Error(`Invalid pin "${pin}" specified in includePins`);
    //     }
    //     newPinMappings[normalizedPin] = pinMappings[normalizedPin];
    //   }
    //   pinMappings = newPinMappings;
    // } else if (Array.isArray(excludePins)) {
    //   pinMappings = Object.assign({}, pinMappings);
    //   for (const pin of excludePins) {
    //     const normalizedPin = this[raspiBoardModule].getPinNumber(pin);
    //     if (normalizedPin === null) {
    //       throw new Error(`Invalid pin "${pin}" specified in excludePins`);
    //     }
    //     delete pinMappings[normalizedPin];
    //   }
    // }

    function createPinEntry(pin: number, pinMapping: IPinInfo): IPinConfiguration {
      const supportedModes = [];
      // TODO: add logic to filter out I2C and Serial so they can't be used for GPIO in raspi-io
      if (pin === LED_PIN) {
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
                return (peripheral as IDigitalInput).read();
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
              return Mode.OUTPUT;
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

  public normalize(pin: number | string): number {
    // LED is a special thing that the underlying platform doesn't know about, and isn't actually a pin.
    // Gotta reroute it here, and we just have it return itself
    if (pin === LED_PIN) {
      return LED_PIN;
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

    if (pin === LED_PIN) {
      // TODO
      // if (pinInstance.peripheral instanceof this[raspiLedModule].LED) {
      //   return;
      // }
      // pinInstance.peripheral = new this[raspiLedModule].LED();
    } else {
      switch (mode) {
        case Mode.INPUT:
          this[gpioManager].setInputMode(normalizedPin);
          break;
        case Mode.OUTPUT:
          this[gpioManager].setOutputMode(normalizedPin);
          break;
        case Mode.PWM:
        case Mode.SERVO:
          // TODO
          // if (pinInstance.isHardwarePwm) {
          //   pinInstance.peripheral = new this[raspiPwmModule].PWM(normalizedPin);
          // } else {
          //   pinInstance.peripheral = new this[raspiSoftPwmModule].SoftPWM({
          //     pin: normalizedPin,
          //     frequency: SOFTWARE_PWM_FREQUENCY,
          //     range: SOFTWARE_PWM_RANGE
          //   });
          // }
          break;
        default:
          throw new Error(`Internal Error: valid pin mode ${mode} not accounted for in switch statement`);
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
    if (pin === LED_PIN) {
      // TODO
      return;
    }
    this[gpioManager].digitalWrite(this.normalize(pin), value);
  }

  // PWM methods

  /*
  public pwmWrite(pin: string | number, value: number): void {
    throw new Error(`pwmWrite is not supported by ${this.name}`);
  }

  public servoWrite(pin: string | number, value: number): void {
    throw new Error(`servoWrite is not supported by ${this.name}`);
  }

  public servoConfig(options: IServoConfig): void;
  public servoConfig(pin: number, min: number, max: number): void;
  public servoConfig(optionsOrPin: IServoConfig | number, min?: number, max?: number): void {
    throw new Error(`servoConfig is not supported by ${this.name}`);
  }
  */

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
