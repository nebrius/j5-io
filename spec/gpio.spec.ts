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

import { CoreIO } from '../src/index';
import {
  createInstance,
  raspiMock,
  pinInfo,
  raspiPWMMock,
  raspiGpioMock,
  Peripheral,
  DigitalInput,
  DigitalOutput
} from './mocks';
import 'jasmine';

// This is used to control how many times we want to successively read using the `digitalRead` method
const NUM_DIGITAL_READS = 10;

// This is used to control how long to wait in ms to ensure no callbacks are called after a peripheral is destroyed
const DESTROY_WAIT = 100;

// List of pin aliases to use that won't collide with I2C or UART
const pinAliases = [
  // GPIO Only
  'GPIO4',
  'GPIO17',
  'GPIO27',
  'GPIO22',
  'GPIO5',
  'GPIO6',
  'GPIO26',
  'GPIO23',
  'GPIO24',
  'GPIO25',
  'GPIO16',

  // Shared with SPI
  'GPIO10',
  'GPIO9',
  'GPIO11',
  'GPIO20',
  'GPIO21',
  'GPIO8',
  'GPIO7',

  // Shared with hardware PWM, shouldn't matter
  'GPIO18',
  'GPIO12',
  'GPIO13',
  'GPIO19', // Also shared with SPI

];

let pinAliasIndex = 0;
function getNextPinAlias() {
  if (pinAliasIndex === pinAliases.length) {
    throw new Error('out of pin aliases');
  }
  return pinAliases[pinAliasIndex++];
}

type GetPinInstances = () => { [pin: number]: Peripheral };

describe('GPIO', () => {

  let raspi: CoreIO;
  beforeEach((done) => {
    createInstance((newRaspi) => {
      raspi = newRaspi;
      done();
    });
  });
  afterEach(() => {
    raspi.reset();
  });

  it('throws an error when resolving an invalid pin', (done) => {
    expect(() => raspi.normalize('GPIO9000')).toThrow(new Error('Unknown pin "GPIO9000"'));
    done();
  });

  it('throws an error when setting a pin to input mode that doesn\'t support it', (done) => {
    expect(() => raspi.pinMode(raspi.defaultLed as number, 0))
      .toThrow(new Error('Pin "-1" does not support mode "input"'));
    done();
  });

  it('throws an error when setting a pin to analog mode that doesn\'t support it', (done) => {
    expect(() => raspi.pinMode('P1-3', 2)).toThrow(new Error('Pin "P1-3" does not support mode "analog"'));
    done();
  });

  it('throws an error when setting a pin to pwm mode that doesn\'t support it', (done) => {
    expect(() => raspi.pinMode('P1-3', 3)).toThrow(new Error('Pin "P1-3" does not support mode "pwm"'));
    done();
  });

  it('throws an error when setting a pin to servo mode that doesn\'t support it', (done) => {
    expect(() => raspi.pinMode('P1-3', 4)).toThrow(new Error('Pin "P1-3" does not support mode "servo"'));
    done();
  });

  it('throws an error when setting a pin to other mode that doesn\'t support it', (done) => {
    expect(() => raspi.pinMode('P1-3', 98)).toThrow(new Error('Unknown mode 98'));
    done();
  });

  it('ignores changes to the default LED pin mode', (done) => {
    const oldPeripheral = (raspi.getInternalPinInstances as GetPinInstances)()[raspi.defaultLed as number];
    raspi.pinMode(raspi.defaultLed as number, 1);
    const newPeripheral = (raspi.getInternalPinInstances as GetPinInstances)()[raspi.defaultLed as number];
    expect(oldPeripheral).toBe(newPeripheral);
    done();
  });

  // Input tests

  it('can set a pin in input mode', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    expect(raspi.pins[pin].mode).toEqual(0);

    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput;
    expect(peripheral.args.length).toEqual(1);
    expect(peripheral.args[0]).toEqual({
      pin,
      pullResistor: 0
    });
    done();
  });

  it('can read from a pin using the `value` property', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput;

    peripheral.setMockedValue(0);
    expect(raspi.pins[pin].value).toEqual(0);
    peripheral.setMockedValue(1);
    expect(raspi.pins[pin].value).toEqual(1);

    done();
  });

  it('can read from a pin using the `digitalRead` method', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);

    let numReadsRemaining = NUM_DIGITAL_READS;
    let value = 0;
    ((raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput).setMockedValue(value);
    raspi.digitalRead(pinAlias, (newValue) => {
      expect(value).toEqual(newValue);
      if (!(--numReadsRemaining)) {
        done();
        return;
      }
      value = value === 1 ? 0 : 1;
      ((raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput).setMockedValue(value);
    });
  });

  it('only calls the callback when the value has changed', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput;

    let numReadCallbacks = 0;
    raspi.digitalRead(pinAlias, () => {
      numReadCallbacks++;
    });
    setInterval(() => {
      peripheral.setMockedValue(0);
    }, 10);
    setTimeout(() => {
      expect(numReadCallbacks).toEqual(1); // We always get 1 read, but shouldn't get more after that
      done();
    }, 100);
  });

  it('can read from a pin in a different mode using the `digitalRead` method', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.OUTPUT);
    expect(raspi.pins[pin].mode).toEqual(raspi.MODES.OUTPUT);
    raspi.digitalRead(pinAlias, () => {
      expect(raspi.pins[pin].mode).toEqual(raspi.MODES.INPUT);
      done();
    });
  });

  it('can read from a pin using the `digitalRead` method after being switched to write mode', (done) => {
    const pinAlias = getNextPinAlias();
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
  });

  it('can read from a pin using the `digital-read-${pin}` event', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);

    let numReadsRemaining = NUM_DIGITAL_READS;
    let value = 0;
    ((raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput).setMockedValue(value);
    raspi.digitalRead(pinAlias, () => {});

    // TODO: follow up on https://github.com/rwaldron/io-plugins/issues/16 to see if we need to rename this event
    raspi.on(`digital-read-${pin}`, (newValue) => {
      expect(value).toEqual(newValue);
      if (!(--numReadsRemaining)) {
        done();
        return;
      }
      value = value === 1 ? 0 : 1;
      ((raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput).setMockedValue(value);
    });
  });

  it('can read from a pin using the `digitalRead` method at no more than 200Hz and no less than 50Hz', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);

    let numReadsRemaining = NUM_DIGITAL_READS;
    let value = 0;

    const startTime = Date.now();
    raspi.digitalRead(pinAlias, () => {
      value = value === 1 ? 0 : 1;
      ((raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput).setMockedValue(value);
      if (!(--numReadsRemaining)) {
        const averagePeriod = (Date.now() - startTime) / NUM_DIGITAL_READS;
        expect(averagePeriod).toBeGreaterThanOrEqual(5); // Less than or equal to 200Hz
        expect(averagePeriod).toBeLessThanOrEqual(20); // Greater than or equal to 50Hz
        done();
        return;
      }
    });
  });

  it('stops reading from the `digitalRead` method after being destroyed', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin];
    raspi.digitalRead(pinAlias, () => {
      expect(peripheral.alive).toBeTruthy();
      peripheral.destroy();
      setTimeout(done, DESTROY_WAIT);
    });
  });

  it('can enable the internal pull up resistor', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const oldPeripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput;
    raspi.digitalWrite(pinAlias, raspi.HIGH);
    const newPeripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput;
    expect(oldPeripheral).not.toBe(newPeripheral);
    expect(newPeripheral.args[0].pullResistor).toEqual(raspiGpioMock.PULL_UP);
    done();
  });

  it('can enable the internal pull down resistor', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    const oldPeripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput;
    raspi.digitalWrite(pinAlias, raspi.LOW);
    const newPeripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalInput;
    expect(oldPeripheral).not.toBe(newPeripheral);
    expect(newPeripheral.args[0].pullResistor).toEqual(raspiGpioMock.PULL_DOWN);
    done();
  });

  // Output tests

  it('can set a pin in output mode after putting it in input mode', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);

    // OUTPUT mode is default, so we force it to input mode first to make sure we can change it back to OUTPUT mode
    expect(raspi.pins[pin].mode).toEqual(1);
    raspi.pinMode(pinAlias, raspi.MODES.INPUT);
    expect(raspi.pins[pin].mode).toEqual(0);
    raspi.pinMode(pinAlias, raspi.MODES.OUTPUT);
    expect(raspi.pins[pin].mode).toEqual(1);

    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalOutput;
    expect(peripheral.args.length).toEqual(1);
    expect(peripheral.args[0]).toEqual(pin);
    done();
  });

  it('can write a value to a pin using the `digitalWrite` method', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);

    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalOutput;
    raspi.digitalWrite(pinAlias, 0);
    expect(peripheral.value).toEqual(0);
    expect(raspi.pins[pin].value).toEqual(0);
    raspi.digitalWrite(pinAlias, 1);
    expect(peripheral.value).toEqual(1);
    expect(raspi.pins[pin].value).toEqual(1);
    done();
  });

  it('can write a value to a pin using the `value` setter', (done) => {
    const pinAlias = getNextPinAlias();
    const pin = raspi.normalize(pinAlias);
    expect(raspi.pins[pin].mode).toEqual(1);

    const peripheral = (raspi.getInternalPinInstances as GetPinInstances)()[pin] as DigitalOutput;
    raspi.pins[pin].value = 0;
    expect(peripheral.value).toEqual(0);
    raspi.pins[pin].value = 1;
    expect(peripheral.value).toEqual(1);
    done();
  });

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

  it('can query capabilities after the ready event has been fired', (done) => {
    raspi.queryCapabilities(done);
  });

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

  it('can query analog mappings after the ready event has been fired', (done) => {
    raspi.queryAnalogMapping(done);
  });

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

  it('can query pin state after the ready event has been fired', (done) => {
    raspi.queryPinState(0, done);
  });
});
