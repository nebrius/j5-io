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
/*global it xdescribe expect*/
const { raspiLEDMock, createInstance } = require('./mocks');
xdescribe('LED', () => {
    it('sets the pin mode properly for the built-in LED', (done) => createInstance((raspi) => {
        expect(raspi.defaultLed).toEqual(-1);
        expect(raspi.pins[raspi.defaultLed].supportedModes.indexOf(1)).not.toEqual(-1);
        const peripheral = raspi.getInternalPinInstances()[-1];
        expect(peripheral instanceof raspiLEDMock.LED).toBeTruthy();
        expect(peripheral.args.length).toEqual(0);
        done();
    }));
    it('can write to the LED', (done) => createInstance((raspi) => {
        const peripheral = raspi.getInternalPinInstances()[-1];
        raspi.digitalWrite(raspi.defaultLed, 0);
        expect(peripheral.read()).toEqual(0);
        raspi.digitalWrite(raspi.defaultLed, 1);
        expect(peripheral.read()).toEqual(1);
        done();
    }));
});
//# sourceMappingURL=led.spec.js.map