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
const DIGITAL_READ_UPDATE_RATE = 18;
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
                if (peripheral.pullResistor !== value) {
                    this.setInputMode(pin, value);
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
        let peripheral = core_1.getPeripheral(pin);
        if (!peripheral || core_1.getMode(peripheral) !== abstract_io_1.Mode.INPUT) {
            this.setInputMode(pin);
            peripheral = core_1.getPeripheral(pin);
        }
        if (!peripheral) {
            throw new Error(`Internal Error: peripheral is undefined even after setting the input mode`);
        }
        let previousReadValue = -1;
        const interval = setInterval(() => {
            if (!peripheral || !peripheral.alive) {
                throw new Error(`Internal Error: read loop executed without a corresponding peripheral`);
            }
            const value = peripheral.read();
            if (value !== previousReadValue) {
                previousReadValue = value;
                if (handler) {
                    handler(value);
                }
                this.eventEmitter.emit(`digital-read-${pin}`, value);
            }
        }, DIGITAL_READ_UPDATE_RATE);
        peripheral.on('destroyed', () => {
            clearInterval(interval);
        });
    }
}
exports.GPIOManager = GPIOManager;
//# sourceMappingURL=gpio.js.map