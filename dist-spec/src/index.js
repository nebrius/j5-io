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
        // Create the plugin name
        this[name] = options.pluginName;
        const { pinInfo, platform } = options;
        // Create the serial port IDs if serial is supported
        if (platform.serial) {
            // TODO: Add these in...where to get them from though?
            this[serialPortIds] = Object.freeze({});
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
        // Slight hack to get the LED in there, since it's not actually a pin
        pinMappings[LED_PIN] = {
            pins: [LED_PIN.toString()],
            peripherals: [core_io_types_1.PeripheralType.GPIO]
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
                                return peripheral.read();
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
                            return abstract_io_1.Mode.OUTPUT;
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
                    throw new Error(`Internal Error: valid pin mode ${mode} not accounted for in switch statement`);
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
}
_a = isReady, _b = pins;
exports.CoreIO = CoreIO;
//# sourceMappingURL=index.js.map