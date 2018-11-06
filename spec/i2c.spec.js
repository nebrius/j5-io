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

// This is used to control how long to wait in ms to ensure a second read wasn't initiated
const READ_WAIT = 100;

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

  it('can read continuously', (done) => createInstance((raspi) => {
    let numReadsRemaining = NUM_READS;
    const peripheral = raspi.getI2CInstance();
    const testData = [];
    let testDataWindow = [ ...inBytes ];
    for (let i = 0; i < numReadsRemaining + 1; i++) {
      testData.push(...testDataWindow);
    }
    peripheral.setReadBuffer(inAddress, undefined, testData);
    raspi.i2cRead(inAddress, inBytes.length, (data) => {
      expect(data).toEqual(inBytes);
    });
    peripheral.on('read', ({ address, length, register, data }) => {
      expect(data).toEqual(inBytes);
      expect(length).toEqual(inBytes.length);
      expect(address).toEqual(inAddress);
      expect(register).toBeUndefined();
      if (!(--numReadsRemaining)) {
        peripheral.destroy();
        done();
        return;
      }
    });
  }));

  it('can read from a register continuously', (done) => createInstance((raspi) => {
    let numReadsRemaining = NUM_READS;
    const peripheral = raspi.getI2CInstance();
    const testData = [];
    let testDataWindow = [ ...inBytes ];
    for (let i = 0; i < numReadsRemaining + 1; i++) {
      testData.push(...testDataWindow);
    }
    peripheral.setReadBuffer(inAddress, inRegister, testData);
    raspi.i2cRead(inAddress, inRegister, inBytes.length, (data) => {
      expect(data).toEqual(inBytes);
    });
    peripheral.on('read', ({ address, length, register, data }) => {
      expect(data).toEqual(inBytes);
      expect(length).toEqual(inBytes.length);
      expect(address).toEqual(inAddress);
      expect(register).toEqual(inRegister);
      if (!(--numReadsRemaining)) {
        peripheral.destroy();
        done();
        return;
      }
    });
  }));

  it('can read once', (done) => createInstance((raspi) => {
    const peripheral = raspi.getI2CInstance();
    const testData = [ ...inBytes ];
    peripheral.setReadBuffer(inAddress, undefined, testData);
    raspi.i2cReadOnce(inAddress, inBytes.length, (data) => {
      expect(data).toEqual(inBytes);
    });
    let numReads = 0;
    peripheral.on('read', ({ address, length, register, data }) => {
      numReads++;
      expect(data).toEqual(inBytes);
      expect(length).toEqual(inBytes.length);
      expect(address).toEqual(inAddress);
      expect(register).toBeUndefined();
      setTimeout(() => {
        expect(numReads).toEqual(1);
        peripheral.destroy();
        done();
      }, READ_WAIT);
    });
  }));

  it('can read once from a register', (done) => createInstance((raspi) => {
    const peripheral = raspi.getI2CInstance();
    const testData = [ ...inBytes ];
    peripheral.setReadBuffer(inAddress, inRegister, testData);
    raspi.i2cReadOnce(inAddress, inRegister, inBytes.length, (data) => {
      expect(data).toEqual(inBytes);
    });
    let numReads = 0;
    peripheral.on('read', ({ address, length, register, data }) => {
      numReads++;
      expect(data).toEqual(inBytes);
      expect(length).toEqual(inBytes.length);
      expect(address).toEqual(inAddress);
      expect(register).toEqual(inRegister);
      setTimeout(() => {
        expect(numReads).toEqual(1);
        peripheral.destroy();
        done();
      }, READ_WAIT);
    });
  }));
});
