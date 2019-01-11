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
const { CoreIO } = require('../dist/index');
const { createInstance, raspiMock, pinInfo, raspiPWMMock, raspiGpioMock } = require('./mocks');
/*global it describe expect*/
// This is used to control how many times we want to successively read using the `digitalRead` method
const NUM_DIGITAL_READS = 10;
// This is used to control how long to wait in ms to ensure no callbacks are called after a peripheral is destroyed
const DESTROY_WAIT = 100;
describe('GPIO', () => {
    const pinAlias = 'GPIO10';
    it('throws an error when resolving an invalid pin', (done) => createInstance((raspi) => {
        expect(() => raspi.normalize('GPIO9000')).toThrow(new Error('Unknown pin "GPIO9000"'));
        done();
    }));
    it('throws an error when setting a pin to input mode that doesn\'t support it', (done) => createInstance((raspi) => {
        expect(() => raspi.pinMode('P1-3', 0)).toThrow(new Error('Pin "P1-3" does not support mode "input"'));
        done();
    }));
    it('throws an error when setting a pin to output mode that doesn\'t support it', (done) => createInstance((raspi) => {
        expect(() => raspi.pinMode('P1-3', 1)).toThrow(new Error('Pin "P1-3" does not support mode "output"'));
        done();
    }));
    it('throws an error when setting a pin to analog mode that doesn\'t support it', (done) => createInstance((raspi) => {
        expect(() => raspi.pinMode('P1-3', 2)).toThrow(new Error('Pin "P1-3" does not support mode "analog"'));
        done();
    }));
    it('throws an error when setting a pin to pwm mode that doesn\'t support it', (done) => createInstance((raspi) => {
        expect(() => raspi.pinMode('P1-3', 3)).toThrow(new Error('Pin "P1-3" does not support mode "pwm"'));
        done();
    }));
    it('throws an error when setting a pin to servo mode that doesn\'t support it', (done) => createInstance((raspi) => {
        expect(() => raspi.pinMode('P1-3', 4)).toThrow(new Error('Pin "P1-3" does not support mode "servo"'));
        done();
    }));
    it('throws an error when setting a pin to other mode that doesn\'t support it', (done) => createInstance((raspi) => {
        expect(() => raspi.pinMode('P1-3', 98)).toThrow(new Error('Unknown mode 98'));
        done();
    }));
    it('ignores changes to the default LED pin mode', (done) => createInstance((raspi) => {
        const oldPeripheral = raspi.getInternalPinInstances()[raspi.defaultLed];
        raspi.pinMode(raspi.defaultLed, 1);
        const newPeripheral = raspi.getInternalPinInstances()[raspi.defaultLed];
        expect(oldPeripheral).toBe(newPeripheral);
        done();
    }));
    // Input tests
    it('can set a pin in input mode', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        expect(raspi.pins[pin].mode).toEqual(1);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        expect(raspi.pins[pin].mode).toEqual(0);
        const peripheral = raspi.getInternalPinInstances()[pin];
        expect(peripheral.args.length).toEqual(1);
        expect(peripheral.args[0]).toEqual({
            pin,
            pullResistor: 0
        });
        done();
    }));
    it('can read from a pin using the `value` property', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        const peripheral = raspi.getInternalPinInstances()[pin];
        peripheral.setMockedValue(0);
        expect(raspi.pins[pin].value).toEqual(0);
        peripheral.setMockedValue(1);
        expect(raspi.pins[pin].value).toEqual(1);
        done();
    }));
    it('can read from a pin using the `digitalRead` method', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        const peripheral = raspi.getInternalPinInstances()[pin];
        let numReadsRemaining = NUM_DIGITAL_READS;
        let value = 0;
        peripheral.setMockedValue(value);
        raspi.digitalRead(pinAlias, (newValue) => {
            expect(value).toEqual(newValue);
            if (!(--numReadsRemaining)) {
                done();
                return;
            }
            value = value === 1 ? 0 : 1;
            peripheral.setMockedValue(value);
        });
    }));
    it('only notifies the callback when the value has changed', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        const peripheral = raspi.getInternalPinInstances()[pin];
        let previouslyReadValue = NaN;
        peripheral.setMockedValue(0);
        raspi.digitalRead(pinAlias, (newValue) => {
            expect(newValue).not.toEqual(previouslyReadValue);
            previouslyReadValue = newValue;
        });
        setTimeout(done, 100);
    }));
    it('can read from a pin in a different mode using the `digitalRead` method', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.OUTPUT);
        expect(raspi.pins[pin].mode).toEqual(raspi.MODES.OUTPUT);
        raspi.digitalRead(pinAlias, () => {
            expect(raspi.pins[pin].mode).toEqual(raspi.MODES.INPUT);
            done();
        });
    }));
    it('can read from a pin using the `digitalRead` method after being switched to write mode', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        let numReadsRemaining = NUM_DIGITAL_READS;
        let value = 0;
        raspi.digitalRead(pinAlias, (newValue) => {
            expect(raspi.pins[pin].mode).toEqual(raspi.MODES.OUTPUT);
            expect(value).toEqual(newValue);
            if (!(--numReadsRemaining)) {
                done();
                return;
            }
            value = value === 1 ? 0 : 1;
            raspi.digitalWrite(pinAlias, value);
        });
        raspi.pinMode(pinAlias, raspi.MODES.OUTPUT);
        expect(raspi.pins[pin].mode).toEqual(raspi.MODES.OUTPUT);
        raspi.digitalWrite(pinAlias, value);
    }));
    it('can read from a pin using the `digital-read-${pin}` event', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        const peripheral = raspi.getInternalPinInstances()[pin];
        let numReadsRemaining = NUM_DIGITAL_READS;
        let value = 0;
        peripheral.setMockedValue(value);
        raspi.digitalRead(pinAlias);
        // TODO: follow up on https://github.com/rwaldron/io-plugins/issues/16 to see if we need to rename this event
        raspi.on(`digital-read-${pinAlias}`, (newValue) => {
            expect(value).toEqual(newValue);
            if (!(--numReadsRemaining)) {
                done();
                return;
            }
            value = value === 1 ? 0 : 1;
            peripheral.setMockedValue(value);
        });
    }));
    it('can read from a pin using the `digitalRead` method at no more than 200Hz and no less than 50Hz', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        const peripheral = raspi.getInternalPinInstances()[pin];
        let numReadsRemaining = NUM_DIGITAL_READS;
        let value = 0;
        const startTime = Date.now();
        raspi.digitalRead(pinAlias, () => {
            value = value === 1 ? 0 : 1;
            peripheral.setMockedValue(value);
            if (!(--numReadsRemaining)) {
                const averagePeriod = (Date.now() - startTime) / NUM_DIGITAL_READS;
                expect(averagePeriod).toBeGreaterThanOrEqual(5); // Less than or equal to 200Hz
                expect(averagePeriod).toBeLessThanOrEqual(20); // Greater than or equal to 50Hz
                done();
                return;
            }
        });
    }));
    it('stops reading from the `digitalRead` method after being destroyed', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        const peripheral = raspi.getInternalPinInstances()[pin];
        raspi.digitalRead(pinAlias, () => {
            expect(peripheral.alive).toBeTruthy();
            peripheral.destroy();
            setTimeout(done, DESTROY_WAIT);
        });
    }));
    it('can enable the internal pull up resistor', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        const oldPeripheral = raspi.getInternalPinInstances()[pin];
        raspi.digitalWrite(pinAlias, raspi.HIGH);
        const newPeripheral = raspi.getInternalPinInstances()[pin];
        expect(oldPeripheral).not.toBe(newPeripheral);
        expect(newPeripheral.args[0].pullResistor).toEqual(raspiGpioMock.PULL_UP);
        done();
    }));
    it('can enable the internal pull down resistor', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        const oldPeripheral = raspi.getInternalPinInstances()[pin];
        raspi.digitalWrite(pinAlias, raspi.LOW);
        const newPeripheral = raspi.getInternalPinInstances()[pin];
        expect(oldPeripheral).not.toBe(newPeripheral);
        expect(newPeripheral.args[0].pullResistor).toEqual(raspiGpioMock.PULL_DOWN);
        done();
    }));
    // Output tests
    it('can set a pin in output mode after putting it in input mode', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        // Note: OUTPUT mode is default, so we force it to input mode first to make sure we can change it back to OUTPUT mode
        expect(raspi.pins[pin].mode).toEqual(1);
        raspi.pinMode(pinAlias, raspi.MODES.INPUT);
        expect(raspi.pins[pin].mode).toEqual(0);
        raspi.pinMode(pinAlias, raspi.MODES.OUTPUT);
        expect(raspi.pins[pin].mode).toEqual(1);
        const peripheral = raspi.getInternalPinInstances()[pin];
        expect(peripheral.args.length).toEqual(1);
        expect(peripheral.args[0]).toEqual(pin);
        done();
    }));
    it('can write a value to a pin using the `digitalWrite` method', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        expect(raspi.pins[pin].mode).toEqual(1);
        const peripheral = raspi.getInternalPinInstances()[pin];
        raspi.digitalWrite(pinAlias, 0);
        expect(peripheral.value).toEqual(0);
        expect(raspi.pins[pin].value).toEqual(0);
        raspi.digitalWrite(pinAlias, 1);
        expect(peripheral.value).toEqual(1);
        expect(raspi.pins[pin].value).toEqual(1);
        done();
    }));
    it('can write a value to a pin using the `value` setter', (done) => createInstance((raspi) => {
        const pin = raspi.normalize(pinAlias);
        expect(raspi.pins[pin].mode).toEqual(1);
        const peripheral = raspi.getInternalPinInstances()[pin];
        raspi.pins[pin].value = 0;
        expect(peripheral.value).toEqual(0);
        raspi.pins[pin].value = 1;
        expect(peripheral.value).toEqual(1);
        done();
    }));
    // Query tests (note that all query methods are just pass-through methods)
    it('can query capabilities before the ready event has been fired', (done) => {
        const raspi = new CoreIO({
            pluginName: 'Raspi IO',
            pinInfo,
            platform: {
                base: raspiMock,
                gpio: raspiGpioMock,
                pwm: raspiPWMMock
            }
        });
        raspi.queryCapabilities(done);
    });
    it('can query capabilities after the ready event has been fired', (done) => createInstance((raspi) => {
        raspi.queryCapabilities(done);
    }));
    it('can query analog mappings before the ready event has been fired', (done) => {
        const raspi = new CoreIO({
            pluginName: 'Raspi IO',
            pinInfo,
            platform: {
                base: raspiMock,
                gpio: raspiGpioMock,
                pwm: raspiPWMMock
            }
        });
        raspi.queryAnalogMapping(done);
    });
    it('can query analog mappings after the ready event has been fired', (done) => createInstance((raspi) => {
        raspi.queryAnalogMapping(done);
    }));
    it('can query pin state before the ready event has been fired', (done) => {
        const raspi = new CoreIO({
            pluginName: 'Raspi IO',
            pinInfo,
            platform: {
                base: raspiMock,
                gpio: raspiGpioMock,
                pwm: raspiPWMMock
            }
        });
        raspi.queryPinState(0, done);
    });
    it('can query pin state after the ready event has been fired', (done) => createInstance((raspi) => {
        raspi.queryPinState(0, done);
    }));
});
//# sourceMappingURL=gpio.spec.js.map