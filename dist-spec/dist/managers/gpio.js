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
const abstract_io_1 = require("abstract-io");
const core_1 = require("../core");
const MIN_READ_EMIT_PERIOD = 2;
class GPIOManager {
    constructor(gpioModule, globalEventEmitter) {
        this.module = gpioModule;
        this.eventEmitter = globalEventEmitter;
    }
    setInputMode(pin, pullResistor = this.module.PULL_NONE) {
        core_1.setMode(this.module.createDigitalInput({ pin, pullResistor }), abstract_io_1.Mode.INPUT);
    }
    setOutputMode(pin) {
        core_1.setMode(this.module.createDigitalOutput(pin), abstract_io_1.Mode.OUTPUT);
    }
    digitalWrite(pin, value) {
        const peripheral = core_1.getPeripheral(pin);
        if (peripheral) {
            const currentMode = core_1.getMode(peripheral);
            // Note: if we are in input mode, digitalWrite sets the pull resistor value
            // instead of changing to output mode and writing the value.
            if (currentMode === abstract_io_1.Mode.INPUT) {
                const newPullResistor = value ? this.module.PULL_UP : this.module.PULL_DOWN;
                if (peripheral.pullResistor !== newPullResistor) {
                    this.setInputMode(pin, newPullResistor);
                }
                return;
            }
            else if (currentMode !== abstract_io_1.Mode.OUTPUT) {
                this.setOutputMode(pin);
            }
        }
        // Need to refetch the peripheral in case it was reinstantiated in the above logic
        core_1.getPeripheral(pin).write(value);
    }
    digitalRead(pin, handler) {
        const peripheral = core_1.getPeripheral(pin);
        if (!peripheral || core_1.getMode(peripheral) !== abstract_io_1.Mode.INPUT) {
            this.setInputMode(pin);
        }
        // Use an arrow function so we can bind "this" properly
        const addListener = () => {
            const currentPeripheral = core_1.getPeripheral(pin);
            if (!currentPeripheral) {
                throw new Error(`Internal Error: peripheral is undefined even after setting the input mode`);
            }
            switch (core_1.getMode(currentPeripheral)) {
                // Note: although we can only initiate this method in INPUT mode, we are supposed to continue
                // reporting values even if it's changed to OUTPUT mode
                case abstract_io_1.Mode.INPUT:
                case abstract_io_1.Mode.OUTPUT:
                    let previousEmitTime = Date.now();
                    currentPeripheral.on('change', (value) => {
                        if (Date.now() - previousEmitTime >= MIN_READ_EMIT_PERIOD) {
                            this.eventEmitter.emit(`digital-read-${pin}`, value);
                            handler(value);
                            previousEmitTime = Date.now();
                        }
                    });
                    // Note: the peripheral instance will change if the pull resistor is changed or the mode is set to OUTPUT
                    // In both of these cases, we still want to emit digital-read-${pin} events
                    currentPeripheral.on('destroyed', () => setImmediate(addListener));
                    break;
                default:
                // Ignore all other modes, as the spec only calls for listening to input and output modes
            }
        };
        addListener();
    }
}
exports.GPIOManager = GPIOManager;
//# sourceMappingURL=gpio.js.map