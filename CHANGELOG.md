## 2.1.0 (2018-04-02)

- Added ability to take in servo values greater than 544 as part of servo class rewrite (thanks @dtex!)

## 2.0.2 (2017-11-22)

- Fixed a bug where the `digital-read-${pin}` event was being fired even when there was no change (thanks @boneskull!)

## 2.0.1 (2017-4-29)

- Fixed a bug in Servo duty cycle calculation

## 2.0.0 (2017-4-23)

- BREAKING CHANGE: Updated PWM value calculation to match breaking changes in raspi-pwm 4.0.0

## 1.1.1 (2017-4-7)

- Republishing because I accidentally had git out of sync

## 1.1.0 (2017-4-7)

- Added the `enableSerial` configuration option, which works the same as `enableSoftPwm`

## 1.0.2 (2017-2-17)

- Improved error messaging around unsupported pin modes

## 1.0.1 (2017-1-9)

- Fixed a bug with not being able to kill the process when run within Johnny-Five

## 1.0.0 (2016-12-30)

- Spun off raspi-io into raspi-io-core
- Reworked this module so that [Raspi.js](https://github.com/nebrius/raspi) is passed in to the constructor of raspi-io-core
  - The idea is that raspi-io will pass raspi.js to this module.

_Note:_ this codebase derives from the [Raspi IO](https://github.com/nebrius/raspi-io) codebase, so consider the [raspi-io changelog](https://github.com/nebrius/raspi-io/blob/master/CHANGELOG.md) to be historically precede this changelog up to version 7.1.0 of raspi-io.
