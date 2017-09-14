# Raspi IO Core

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/nebrius/raspi-io?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

Raspi IO Core is a Firmata API compatible abstract library for creating [Johnny-Five](http://johnny-five.io/) IO plugins targeting the [Raspberry Pi](http://www.raspberrypi.org/). The API docs for this module can be found on the [Johnny-Five Wiki](https://github.com/rwaldron/io-plugins), except for the constructor which is documented below.

If you have a bug report, feature request, or wish to contribute code, please be sure to check out the [Raspi IO Contributing Guide](https://github.com/nebrius/raspi-io/blob/master/CONTRIBUTING.md).

## Installation

Install with npm:

```Shell
npm install raspi-io-core
```

## Usage

Using raspi-io-core to create a Johnny-Five IO plugin should look something like this:

```JavaScript
import { RaspiIOCore } from 'raspi-io-core';

module.exports = function RaspiIO({ includePins, excludePins, enableSoftPwm = false } = {}) {

  // Create the platform options
  const platform = {
    'raspi': require('raspi'),
    'raspi-board': require('raspi-board'),
    'raspi-gpio': require('raspi-gpio'),
    'raspi-i2c': require('raspi-i2c'),
    'raspi-led': require('raspi-led'),
    'raspi-pwm': require('raspi-pwm'),
    'raspi-serial': require('raspi-serial'),
  };

  if (enableSoftPwm) {
    platform['raspi-soft-pwm'] = require('raspi-soft-pwm');
  }

  return new RaspiIOCore({
    includePins,
    excludePins,
    enableSoftPwm,
    platform
  });
}
```

## API

### new raspi(options)

Instantiates a new Raspi IO Core instance with the given options

_Arguments_:

<table>
  <thead>
    <tr>
      <th>Argument</th>
      <th>Type</th>
      <th>Description</th>
    </tr>
  </thead>
  <tr>
    <td>options</td>
    <td>Object</td>
    <td>The configuration options.</td>
  </tr>
  <tr>
    <td></td>
    <td colspan="2">
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tr>
          <td>enableSerial (optional)</td>
          <td>boolean</td>
          <td>Enables the use of the serial port by Johnny-Five. The default value is <code>false</code></td>
        </tr>
        <tr>
          <td>enableSoftPwm (optional)</td>
          <td>boolean</td>
          <td>Use a software-based approach to PWM on GPIO pins that do not support hardware PWM. The <a href="https://github.com/tralves/raspi-soft-pwm"><code>raspi-soft-pwm</code> library</a> is used to enable this.
          <br/><br/>
          The default value is <code>false</code>.
          <br/><br/>
          <strong>Note:</strong> the timing of software PWM may not be as accurate as hardware PWM.
          </td>
        </tr>
        <tr>
          <td>includePins (optional)</td>
          <td>Array&lt;Number|String&gt;</td>
          <td>A list of pins to include in initialization. Any pins not listed here will not be initialized or available for use by Raspi IO</td>
        </tr>
        <tr>
          <td>excludePins (optional)</td>
          <td>Array&lt;Number|String&gt;</td>
          <td>A list of pins to exclude from initialization. Any pins listed here will not be initialized or available for use by Raspi IO</td>
        </tr>
        <tr>
          <td>platform</td>
          <td>Object</td>
          <td>The set of platform plugins</td>
        </tr>
        <tr>
          <td></td>
          <td colspan="2">
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tr>
                <td>raspi</td>
                <td>Object</td>
                <td>The "raspi" module to use, e.g. https://github.com/nebrius/raspi</td>
              </tr>
              <tr>
                <td>raspi-board</td>
                <td>Object</td>
                <td>The "raspi-board" module to use, e.g. https://github.com/nebrius/raspi-board</td>
              </tr>
              <tr>
                <td>raspi-gpio</td>
                <td>Object</td>
                <td>The "raspi-gpio" module to use, e.g. https://github.com/nebrius/raspi-gpio</td>
              </tr>
              <tr>
                <td>raspi-i2c</td>
                <td>Object</td>
                <td>The "raspi-i2c" module to use, e.g. https://github.com/nebrius/raspi-i2c</td>
              </tr>
              <tr>
                <td>raspi-led</td>
                <td>Object</td>
                <td>The "raspi-led" module to use, e.g. https://github.com/nebrius/raspi-led</td>
              </tr>
              <tr>
                <td>raspi-pwm</td>
                <td>Object</td>
                <td>The "raspi-pwm" module to use, e.g. https://github.com/nebrius/raspi-pwm</td>
              </tr>
              <tr>
                <td>raspi-serial</td>
                <td>Object</td>
                <td>The "raspi-serial" module to use, e.g. https://github.com/nebrius/raspi-serial</td>
              </tr>
              <tr>
                <td>raspi-soft-pwm (optional)</td>
                <td>Object</td>
                <td>The "raspi-soft-pwm" module to use, e.g. https://github.com/nebrius/raspi-soft-pwm. This only needs to be supplied if the <code>enableSoftPwm</code> flag is set to <code>true</code></td>
              </tr>
            </table>
          </td>
        </tr>
        </tr>
      </table>
    </td>
  </tr>
</table>

License
=======

The MIT License (MIT)

Copyright (c) 2013-2016 Bryan Hughes <bryan@nebri.us>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
