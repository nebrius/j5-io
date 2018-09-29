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

describe('Serial', () => {
  it('rejects on a missing options object', (done) => createInstance((raspi) => {
    expect(() => {
      raspi.serialConfig();
    }).toThrow();
    done();
  }));

  it('rejects on a missing `portId` parameter in the options object', (done) => createInstance((raspi) => {
    expect(() => {
      raspi.serialConfig({});
    }).toThrow(new Error('"portId" parameter missing in options'));
    done();
  }));

  it('rejects a reconfiguration with an invalid portId', (done) => createInstance((raspi) => {
    expect(() => {
      raspi.serialConfig({
        portId: 'invalid'
      });
    }).toThrow(new Error(`Invalid serial port "invalid"`));
    done();
  }));

  it('sets default parameters on initialization', (done) => createInstance((raspi) => {
    raspi.on('$TEST_MODE-serial-instance-created', (peripheral) => {
      expect(peripheral.port).toEqual(raspi.SERIAL_PORT_IDs.DEFAULT);
      expect(peripheral.baudRate).toEqual(9600);
      done();
    });
  }));

  it('can reconfigure the port with just a portId', (done) => createInstance((raspi) => {
    raspi.on('$TEST_MODE-serial-instance-created', () => {
      raspi.serialConfig({
        portId: raspi.SERIAL_PORT_IDs.DEFAULT
      });
      raspi.on('$TEST_MODE-serial-instance-created', (peripheral) => {
        expect(peripheral.port).toEqual(raspi.SERIAL_PORT_IDs.DEFAULT);
        expect(peripheral.baudRate).toEqual(9600);
        done();
      });
    });
  }));

  it('can reconfigure the port with a portId and baud', (done) => createInstance((raspi) => {
    raspi.on('$TEST_MODE-serial-instance-created', () => {
      raspi.serialConfig({
        portId: raspi.SERIAL_PORT_IDs.DEFAULT,
        baud: 115200
      });
      raspi.on('$TEST_MODE-serial-instance-created', (peripheral) => {
        expect(peripheral.port).toEqual(raspi.SERIAL_PORT_IDs.DEFAULT);
        expect(peripheral.baudRate).toEqual(115200);
        done();
      });
    });
  }));

  it('can write data to the port', (done) => createInstance((raspi) => {
    raspi.on('$TEST_MODE-serial-instance-created', (peripheral) => {
      const inBytes = [ 0, 1, 2, 3, 4 ];
      peripheral.on('write', (data) => {
        expect(data).toEqual(inBytes);
        done();
      });
      raspi.serialWrite(raspi.SERIAL_PORT_IDs.DEFAULT, inBytes);
    });
  }));

  it('can read data from the port', (done) => createInstance((raspi) => {
    raspi.on('$TEST_MODE-serial-instance-created', (peripheral) => {
      peripheral.on('open', () => {
        const inBytes = [ 0, 1, 2, 3, 4 ];
        raspi.serialRead(raspi.SERIAL_PORT_IDs.DEFAULT, (data) => {
          expect(data).toEqual(inBytes);
          done();
        });
        peripheral.fillReadBuffer(inBytes);
      });
    });
  }));
});

it('can read data from the port using the `serial-data-${portId}` event', (done) => createInstance((raspi) => {
  raspi.on('$TEST_MODE-serial-instance-created', (peripheral) => {
    peripheral.on('open', () => {
      const inBytes = [ 0, 1, 2, 3, 4 ];
      raspi.on(`serial-data-${raspi.SERIAL_PORT_IDs.DEFAULT}`, (data) => {
        expect(data).toEqual(inBytes);
        done();
      });
      peripheral.fillReadBuffer(inBytes);
    });
  });
}));

// TODO: add support for maxBytesToRead in serialRead tests

it('can stop a serial port', (done) => createInstance((raspi) => {
  raspi.on('$TEST_MODE-serial-instance-created', (peripheral) => {
    peripheral.on('open', () => {
      const inBytes = [ 0, 1, 2, 3, 4 ];
      raspi.on(`serial-data-${raspi.SERIAL_PORT_IDs.DEFAULT}`, () => {
        throw new Error('Serial did not stop');
      });
      raspi.serialStop(raspi.SERIAL_PORT_IDs.DEFAULT);
      peripheral.fillReadBuffer(inBytes);
      setTimeout(done, 10);
    });
  });
}));

it('can close a serial port', (done) => createInstance((raspi) => {
  raspi.on('$TEST_MODE-serial-instance-created', (peripheral) => {
    peripheral.on('open', () => {
      raspi.serialClose(raspi.SERIAL_PORT_IDs.DEFAULT);
      peripheral.on('close', () => {
        // TODO: this is kinda ugly, but the internal pump mechanism hasn't finished
        // running when we get here, so we have to delay a little longer to make the
        // exception thrown from a closed port asynchronous
        setTimeout(() => {
          expect(() => {
            raspi.serialWrite(raspi.SERIAL_PORT_IDs.DEFAULT, []);
          }).toThrow(new Error('Cannot write to closed serial port'));
          done();
        }, 10);
      });
    });
  });
}));

// TODO: test serialFlush
