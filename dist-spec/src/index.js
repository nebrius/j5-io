"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var _a, _b;
"use strict";
const core_io_types_1 = require("core-io-types");
const abstract_io_1 = require("abstract-io");
const core_1 = require("./core");
const gpio_1 = require("./managers/gpio");
// Constants
const LED_PIN = -1;
// Private symbols for public getters
const serialPortIds = Symbol('serialPortIds');
const name = Symbol('name');
const isReady = Symbol('isReady');
const pins = Symbol('pins');
// Private symbols for internal properties
const gpioManager = Symbol('gpioManager');
class CoreIO extends abstract_io_1.AbstractIO {
    constructor(options) {
        super();
        this[_a] = false;
        this[_b] = [];
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
                throw new Error('"options.serialIds" is required and must be an object when options.platform.serial is also supplied');
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
        }
        else {
            this[serialPortIds] = Object.freeze({});
        }
        // Instantiate the peripheral managers
        core_1.setBaseModule(platform.base);
        this[gpioManager] = new gpio_1.GPIOManager(platform.gpio, this);
        // Inject the test only methods if we're in test mode
        if (process.env.RASPI_IO_TEST_MODE) {
            this.getInternalPinInstances = () => core_1.getPeripherals();
            // TODO:
            // this.getI2CInstance = () => this[i2c];
        }
        // Create the pins object
        this[pins] = [];
        const pinMappings = Object.assign({}, pinInfo);
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
        function createPinEntry(pin, pinMapping) {
            const supportedModes = [];
            // TODO: add logic to filter out I2C and Serial so they can't be used for GPIO in raspi-io
            if (pin === LED_PIN) {
                supportedModes.push(abstract_io_1.Mode.OUTPUT);
            }
            else if (pinMapping.peripherals.indexOf(core_io_types_1.PeripheralType.GPIO) !== -1) {
                supportedModes.push(abstract_io_1.Mode.INPUT, abstract_io_1.Mode.OUTPUT);
            }
            if (pinMapping.peripherals.indexOf(core_io_types_1.PeripheralType.PWM) !== -1) {
                supportedModes.push(abstract_io_1.Mode.PWM, abstract_io_1.Mode.SERVO);
            }
            return Object.create(null, {
                supportedModes: {
                    enumerable: true,
                    value: Object.freeze(supportedModes)
                },
                mode: {
                    enumerable: true,
                    get() {
                        const peripheral = core_1.getPeripheral(pin);
                        if (!peripheral) {
                            return abstract_io_1.Mode.UNKOWN;
                        }
                        return core_1.getMode(peripheral);
                    }
                },
                value: {
                    enumerable: true,
                    get() {
                        const peripheral = core_1.getPeripheral(pin);
                        if (!peripheral) {
                            return null;
                        }
                        switch (core_1.getMode(peripheral)) {
                            case abstract_io_1.Mode.INPUT:
                                return peripheral.value;
                            case abstract_io_1.Mode.OUTPUT:
                                return peripheral.value;
                            default:
                                return null;
                        }
                    },
                    set(value) {
                        const peripheral = core_1.getPeripheral(pin);
                        if (peripheral && core_1.getMode(peripheral) === abstract_io_1.Mode.OUTPUT) {
                            peripheral.write(value);
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
            if (this[pins][pin].supportedModes.indexOf(abstract_io_1.Mode.OUTPUT) !== -1) {
                this.pinMode(pin, abstract_io_1.Mode.OUTPUT);
                this.digitalWrite(pin, abstract_io_1.Value.LOW);
            }
        }
        // Slight hack to get the LED in there, since it's not actually a pin
        this[pins][LED_PIN] = Object.create(null, {
            supportedModes: {
                enumerable: true,
                value: Object.freeze([abstract_io_1.Mode.OUTPUT])
            },
            mode: {
                enumerable: true,
                get() {
                    return abstract_io_1.Mode.OUTPUT;
                }
            },
            value: {
                enumerable: true,
                get() {
                    // TODO: wire into LED manager or something
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
                            return abstract_io_1.Mode.UNKOWN;
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
    get defaultLed() {
        return LED_PIN;
    }
    get name() {
        return this[name];
    }
    get SERIAL_PORT_IDs() {
        return this[serialPortIds];
    }
    get pins() {
        return Object.freeze(this[pins]);
    }
    get analogPins() {
        return Object.freeze([]);
    }
    get isReady() {
        return this[isReady];
    }
    normalize(pin) {
        // LED is a special thing that the underlying platform doesn't know about, and isn't actually a pin.
        // Gotta reroute it here, and we just have it return itself
        if (pin === LED_PIN) {
            return LED_PIN;
        }
        return core_1.normalizePin(pin);
    }
    pinMode(pin, mode) {
        const normalizedPin = this.normalize(pin);
        // Make sure that the requested pin mode is valid and supported by the pin in question
        if (!abstract_io_1.Mode.hasOwnProperty(mode)) {
            throw new Error(`Unknown mode ${mode}`);
        }
        else if (this[pins][normalizedPin].supportedModes.indexOf(mode) === -1) {
            throw new Error(`Pin "${pin}" does not support mode "${abstract_io_1.Mode[mode].toLowerCase()}"`);
        }
        if (pin === LED_PIN) {
            // TODO
            // if (pinInstance.peripheral instanceof this[raspiLedModule].LED) {
            //   return;
            // }
            // pinInstance.peripheral = new this[raspiLedModule].LED();
        }
        else {
            switch (mode) {
                case abstract_io_1.Mode.INPUT:
                    this[gpioManager].setInputMode(normalizedPin);
                    break;
                case abstract_io_1.Mode.OUTPUT:
                    this[gpioManager].setOutputMode(normalizedPin);
                    break;
                case abstract_io_1.Mode.PWM:
                case abstract_io_1.Mode.SERVO:
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
                    throw new Error(core_1.createInternalErrorMessage(`valid pin mode ${mode} not accounted for in switch statement`));
            }
        }
    }
    // GPIO methods
    digitalRead(pin, handler) {
        this[gpioManager].digitalRead(this.normalize(pin), handler);
    }
    digitalWrite(pin, value) {
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
    serialConfig(options) {
        // TODO
    }
}
_a = isReady, _b = pins;
exports.CoreIO = CoreIO;
//# sourceMappingURL=index.js.map