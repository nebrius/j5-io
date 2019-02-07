"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const index_1 = require("../src/index");
const mocks_1 = require("./mocks");
const abstract_io_1 = require("abstract-io");
const core_io_types_1 = require("core-io-types");
describe('App Instantiation', () => {
    // TODO: test "reset" method
    let raspi;
    afterEach(() => {
        if (raspi) {
            raspi.reset();
            raspi = undefined;
        }
    });
    it('requires an options argument', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO();
        }).toThrow(new Error('"options" is required and must be an object'));
    });
    it('requires an options argument to be an object', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO(`I'm not an object`);
        }).toThrow(new Error('"options" is required and must be an object'));
    });
    it('requires the pluginName argument', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO({});
        }).toThrow(new Error('"options.pluginName" is required and must be a string'));
    });
    it('requires the pluginName argument to be a string', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO({
                pluginName: 10
            });
        }).toThrow(new Error('"options.pluginName" is required and must be a string'));
    });
    it('requires the pinInfo argument', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO({
                pluginName: 'Raspi IO'
            });
        }).toThrow(new Error('"options.pinInfo" is required and must be an object'));
    });
    it('requires the platform argument', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO({
                pluginName: 'Raspi IO',
                pinInfo: {}
            });
        }).toThrow(new Error('"options.platform" is required and must be an object'));
    });
    it('requires the platform.base argument', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO({
                pluginName: 'Raspi IO',
                pinInfo: mocks_1.pinInfo,
                platform: {}
            });
        }).toThrow(new Error('"options.platform.base" is required and must be an object'));
    });
    it('requires the platform.gpio argument', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO({
                pluginName: 'Raspi IO',
                pinInfo: mocks_1.pinInfo,
                platform: {
                    base: mocks_1.raspiMock
                }
            });
        }).toThrow(new Error('"options.platform.gpio" is required and must be an object'));
    });
    it('requires the platform.pwm argument', () => {
        expect(() => {
            // tslint:disable
            new index_1.CoreIO({
                pluginName: 'Raspi IO',
                pinInfo: mocks_1.pinInfo,
                platform: {
                    base: mocks_1.raspiMock,
                    gpio: mocks_1.raspiGpioMock
                }
            });
        }).toThrow(new Error('"options.platform.pwm" is required and must be an object'));
    });
    it('does not require the platform.serial argument', () => {
        expect(() => {
            raspi = new index_1.CoreIO({
                pluginName: 'Raspi IO',
                pinInfo: mocks_1.pinInfo,
                platform: {
                    base: mocks_1.raspiMock,
                    gpio: mocks_1.raspiGpioMock,
                    pwm: mocks_1.raspiPWMMock
                }
            });
        }).not.toThrow();
    });
    // TODO: test when i2cIds is missing
    it('requires the serialIds argument when the platform.serial argument is present', () => {
        expect(() => {
            new index_1.CoreIO({
                pluginName: 'Raspi IO',
                pinInfo: mocks_1.pinInfo,
                platform: {
                    base: mocks_1.raspiMock,
                    gpio: mocks_1.raspiGpioMock,
                    pwm: mocks_1.raspiPWMMock,
                    serial: mocks_1.raspiSerialMock
                }
            });
        }).toThrow(new Error('"options.serialIds" is required and must be an object when options.platform.serial is also supplied'));
    });
    it('requires the serialIds.DEFAULT argument when the platform.serial argument is present', () => {
        expect(() => {
            new index_1.CoreIO({
                pluginName: 'Raspi IO',
                pinInfo: mocks_1.pinInfo,
                platform: {
                    base: mocks_1.raspiMock,
                    gpio: mocks_1.raspiGpioMock,
                    pwm: mocks_1.raspiPWMMock,
                    serial: mocks_1.raspiSerialMock
                },
                serialIds: {}
            });
        }).toThrow(new Error('"DEFAULT" serial ID is required in options.serialIds'));
    });
    it('is an instance of an Event Emitter', () => {
        raspi = new index_1.CoreIO({
            pluginName: 'Raspi IO',
            pinInfo: mocks_1.pinInfo,
            platform: {
                base: mocks_1.raspiMock,
                gpio: mocks_1.raspiGpioMock,
                pwm: mocks_1.raspiPWMMock
            }
        });
        expect(raspi instanceof events_1.EventEmitter).toBeTruthy();
    });
});
describe('App Initialization', () => {
    let raspi;
    afterEach(() => {
        raspi.reset();
    });
    it('emits "ready" and "connect" events on initialization', (done) => {
        raspi = new index_1.CoreIO({
            pluginName: 'Raspi IO',
            pinInfo: mocks_1.pinInfo,
            platform: {
                base: mocks_1.raspiMock,
                gpio: mocks_1.raspiGpioMock,
                pwm: mocks_1.raspiPWMMock
            }
        });
        expect('isReady' in raspi).toBeTruthy();
        expect(raspi.isReady).toBe(false);
        let readyEmitted = false;
        let connectEmitted = false;
        function finalize() {
            if (readyEmitted && connectEmitted) {
                expect(raspi.isReady).toBe(true);
                done();
            }
        }
        raspi.on('ready', () => {
            readyEmitted = true;
            finalize();
        });
        raspi.on('connect', () => {
            connectEmitted = true;
            finalize();
        });
    });
    function isPropertyFrozenAndReadOnly(obj, property) {
        expect(property in obj).toBeTruthy();
        expect(Object.isFrozen(obj[property])).toBeTruthy();
        // We have to loop up the prototype chain, cause sometimes these properties come from the Abstract IO base class
        let descriptor;
        let proto = obj;
        while (proto !== null) {
            descriptor = Object.getOwnPropertyDescriptor(proto, property);
            if (descriptor) {
                break;
            }
            proto = Object.getPrototypeOf(proto);
        }
        expect(descriptor).not.toBeUndefined();
        expect(descriptor.writable).toBeFalsy();
    }
    it('creates the `MODES` property', (done) => mocks_1.createInstance((newRaspi) => {
        raspi = newRaspi;
        isPropertyFrozenAndReadOnly(raspi, 'MODES');
        expect(raspi.MODES).toEqual(Object.freeze({
            INPUT: 0,
            OUTPUT: 1,
            ANALOG: 2,
            PWM: 3,
            SERVO: 4,
            UNKNOWN: 99
        }));
        done();
    }));
    it('creates the `SERIAL_PORT_IDs` property', (done) => mocks_1.createInstance((newRaspi) => {
        raspi = newRaspi;
        isPropertyFrozenAndReadOnly(raspi, 'SERIAL_PORT_IDs');
        expect(raspi.SERIAL_PORT_IDs).toEqual(Object.freeze({
            DEFAULT: '/dev/ttyAMA0'
        }));
        done();
    }));
    it('creates the `pins` property', (done) => mocks_1.createInstance((newRaspi) => {
        raspi = newRaspi;
        isPropertyFrozenAndReadOnly(raspi, 'pins');
        const pins = [];
        pins[-1] = {
            supportedModes: [abstract_io_1.Mode.OUTPUT],
            mode: 1,
            value: 0,
            report: 1,
            analogChannel: 127
        };
        Object.keys(mocks_1.pinInfo).forEach((pin) => {
            const parsedPin = parseInt(pin, 10);
            const supportedModes = [];
            const pinInfo = mocks_1.pinInfo[parsedPin];
            if (pinInfo.peripherals.indexOf(core_io_types_1.PeripheralType.UART) !== -1) {
                supportedModes.push(99);
            }
            else if (pinInfo.peripherals.indexOf(core_io_types_1.PeripheralType.I2C) !== -1) {
                supportedModes.push(99);
            }
            else {
                if (pinInfo.peripherals.indexOf(core_io_types_1.PeripheralType.GPIO) != -1) {
                    supportedModes.push(0, 1);
                }
                if (pinInfo.peripherals.indexOf(core_io_types_1.PeripheralType.PWM) != -1) {
                    supportedModes.push(3, 4);
                }
            }
            const mode = supportedModes.indexOf(1) == -1 ? 99 : 1;
            pins[parsedPin] = {
                supportedModes,
                mode,
                value: supportedModes.indexOf(1) !== -1 ? 0 : null,
                report: 1,
                analogChannel: 127
            };
        });
        for (let i = 0; i < pins.length; i++) {
            if (!pins[i]) {
                pins[i] = {
                    supportedModes: [],
                    mode: 99,
                    value: 0,
                    report: 1,
                    analogChannel: 127
                };
            }
        }
        expect(raspi.pins).toEqual(pins);
        done();
    }));
    it('creates the `analogPins` property', (done) => mocks_1.createInstance((newRaspi) => {
        raspi = newRaspi;
        isPropertyFrozenAndReadOnly(raspi, 'analogPins');
        expect(raspi.analogPins).toEqual([]);
        done();
    }));
});
//# sourceMappingURL=init.spec.js.map