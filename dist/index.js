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
const pwm_1 = require("./managers/pwm");
const led_1 = require("./managers/led");
const serial_1 = require("./managers/serial");
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
const serialManager = Symbol('serialManager');
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
        this[pwmManager] = new pwm_1.PWMManager(platform.pwm);
        if (platform.led) {
            this[defaultLed] = led_1.DEFAULT_LED_PIN;
            this[ledManager] = new led_1.LEDManager(platform.led);
        }
        if (platform.serial) {
            this[serialManager] = new serial_1.SerialManager(platform.serial, this);
        }
        // Inject the test only methods if we're in test mode
        if (process.env.RASPI_IO_TEST_MODE) {
            this.getInternalPinInstances = () => core_1.getPeripherals();
            this.getLEDInstance = () => this[ledManager] && this[ledManager].led;
            // TODO:
            // this.getI2CInstance = () => this[i2c];
        }
        // Create the pins object
        this[pins] = [];
        const pinMappings = Object.assign({}, pinInfo);
        function createPinEntry(pin, pinMapping) {
            const supportedModes = [];
            if (platform.led && pin === led_1.DEFAULT_LED_PIN) {
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
        // Add the virtual LED pin, since it's not a real pin, but only if a built-in LED is provided
        if (platform.led) {
            this[pins][led_1.DEFAULT_LED_PIN] = Object.create(null, {
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
                        const ledManagerInstance = this[ledManager];
                        if (ledManagerInstance) {
                            return ledManagerInstance.getCurrentValue();
                        }
                        else {
                            return abstract_io_1.Value.LOW;
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
        if (this[ledManager]) {
            return this[defaultLed];
        }
        else {
            throw new Error(`${this.name} does not have a default LED`);
        }
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
    reset() {
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
    normalize(pin) {
        // LED is a special thing that the underlying platform doesn't know about, and isn't actually a pin.
        // Gotta reroute it here, and we just have it return the pin that's passed in
        if (this[ledManager] && pin === led_1.DEFAULT_LED_PIN) {
            return led_1.DEFAULT_LED_PIN;
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
        if (this[ledManager] && pin === led_1.DEFAULT_LED_PIN) {
            // Note: the LED module is a dedicated peripheral and can't be any other mode, so we can shortcut here
            return;
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
                    this[pwmManager].setPWMMode(normalizedPin);
                    break;
                case abstract_io_1.Mode.SERVO:
                    this[pwmManager].setServoMode(normalizedPin);
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
        const ledManagerInstance = this[ledManager];
        if (ledManagerInstance && pin === led_1.DEFAULT_LED_PIN) {
            ledManagerInstance.digitalWrite(value);
        }
        else {
            this[gpioManager].digitalWrite(this.normalize(pin), value);
        }
    }
    // PWM methods
    pwmWrite(pin, value) {
        this[pwmManager].pwmWrite(this.normalize(pin), value);
    }
    servoWrite(pin, value) {
        this[pwmManager].servoWrite(this.normalize(pin), value);
    }
    servoConfig(optionsOrPin, min, max) {
        if (typeof optionsOrPin === 'number' || typeof optionsOrPin === 'string') {
            if (typeof min !== 'number') {
                throw new Error(`"min" must be a number`);
            }
            if (typeof max !== 'number') {
                throw new Error(`"max" must be a number`);
            }
        }
        else if (typeof optionsOrPin === 'object') {
            min = optionsOrPin.min;
            max = optionsOrPin.max;
            optionsOrPin = optionsOrPin.pin;
        }
        else {
            throw new Error('optionsOrPin must be a number, string, or object');
        }
        this[pwmManager].servoConfig(this.normalize(optionsOrPin), min, max);
    }
    // Serial Methods
    serialConfig(options) {
        const serialManagerInstance = this[serialManager];
        if (!serialManagerInstance) {
            throw new Error('Serial support is disabled');
        }
        serialManagerInstance.serialConfig(options);
    }
    serialWrite(portId, inBytes) {
        const serialManagerInstance = this[serialManager];
        if (!serialManagerInstance) {
            throw new Error('Serial support is disabled');
        }
        serialManagerInstance.serialWrite(portId, inBytes);
    }
    serialRead(portId, maxBytesToReadOrHandler, handler) {
        const serialManagerInstance = this[serialManager];
        if (!serialManagerInstance) {
            throw new Error('Serial support is disabled');
        }
        serialManagerInstance.serialRead(portId, maxBytesToReadOrHandler, handler);
    }
    serialStop(portId) {
        const serialManagerInstance = this[serialManager];
        if (!serialManagerInstance) {
            throw new Error('Serial support is disabled');
        }
        serialManagerInstance.serialStop(portId);
    }
    serialClose(portId) {
        const serialManagerInstance = this[serialManager];
        if (!serialManagerInstance) {
            throw new Error('Serial support is disabled');
        }
        serialManagerInstance.serialClose(portId);
    }
    serialFlush(portId) {
        const serialManagerInstance = this[serialManager];
        if (!serialManagerInstance) {
            throw new Error('Serial support is disabled');
        }
        serialManagerInstance.serialFlush(portId);
    }
}
_a = isReady, _b = pins;
exports.CoreIO = CoreIO;
//# sourceMappingURL=index.js.map