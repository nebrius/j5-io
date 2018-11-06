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

// This is used to control how many times we want to successively read using the `i2cRead` method
const NUM_READS = 10;

describe('I2C', () => {

  const inBytes = [ 0, 1, 2, 3, 4 ];
  const inByte = 6;
  const inAddress = 0x10;
  const inRegister = 0x20;

  // TODO: ensure that doing GPIO things on I2C pins throws an error

  // TODO: test i2cConfig once https://github.com/nebrius/raspi-io-core/issues/8 has been resolved

  it('can write a buffer to an address', (done) => createInstance((raspi) => {
    const i2c = raspi.getI2CInstance();
    i2c.on('write', ({ address, register, buffer }) => {
      expect(address).toEqual(inAddress);
      expect(register).toBeUndefined();
      expect(buffer).toEqual(inBytes);
    });
    raspi.i2cWrite(inAddress, inBytes)
    done();
  }));

  it('can write a buffer to a register at address', (done) => createInstance((raspi) => {
    const i2c = raspi.getI2CInstance();
    i2c.on('write', ({ address, register, buffer }) => {
      expect(address).toEqual(inAddress);
      expect(register).toEqual(inRegister);
      expect(buffer).toEqual(inBytes);
    });
    raspi.i2cWrite(inAddress, inRegister, inBytes)
    done();
  }));

  it('can write a byte to a register at address', (done) => createInstance((raspi) => {
    const i2c = raspi.getI2CInstance();
    i2c.on('writeByteSync', ({ address, register, byte }) => {
      expect(address).toEqual(inAddress);
      expect(register).toEqual(inRegister);
      expect(byte).toEqual(inByte);
    });
    raspi.i2cWriteReg(inAddress, inRegister, inByte)
    done();
  }));

  it('can read from an address', (done) => createInstance((raspi) => {
    let numReadsRemaining = NUM_READS;
    const peripheral = raspi.getI2CInstance();
    let testData = [ ...inBytes ];
    peripheral.setReadBuffer(inAddress, [ ...testData ]);
    raspi.i2cRead(inAddress, testData.length, (data) => {
      expect(data).toEqual(testData);
      if (!(--numReadsRemaining)) {
        peripheral.destroy();
        done();
        return;
      }
      testData = [ testData.pop(), ...testData ];
      peripheral.setReadBuffer(inAddress, [ ...testData ]);
    });
  }));

  // i2cRead(address, register, bytesToRead, handler)
  // i2cRead(address, bytesToRead, handler)
  // i2cReadOnce(address, register, bytesToRead, handler)
  // i2cReadOnce(address, bytesToRead, handler)
  // i2cConfig(options)
});
