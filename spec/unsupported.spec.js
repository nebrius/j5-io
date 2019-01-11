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

/*global it describe expect*/

const { createInstance } = require('./mocks');

describe('Unsupported', () => {

  function testUnsupported(method) {
    it(`throws an exception when trying to call \`${method}\``, (done) => createInstance((raspi) => {
      expect(() => {
        raspi[method]();
      }).toThrow(new Error(`${method} is not supported by Raspi IO`));
      done();
    }));
  }

  testUnsupported('reset');
  testUnsupported('analogRead');
  testUnsupported('sendOneWireConfig');
  testUnsupported('sendOneWireSearch');
  testUnsupported('sendOneWireAlarmsSearch');
  testUnsupported('sendOneWireRead');
  testUnsupported('sendOneWireReset');
  testUnsupported('sendOneWireWrite');
  testUnsupported('sendOneWireDelay');
  testUnsupported('sendOneWireWriteAndRead');
  testUnsupported('setSamplingInterval');
  testUnsupported('reportAnalogPin');
  testUnsupported('reportDigitalPin');
  testUnsupported('pingRead');
  testUnsupported('pulseIn');
  testUnsupported('stepperConfig');
  testUnsupported('stepperStep');
});
