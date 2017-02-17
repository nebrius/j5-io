## 1.0.2 (2017-2-17)

- Improved error messaging around unsupported pin modes

## 1.0.1 (2017-1-9)

- Fixed a bug with not being able to kill the process when run within Johnny-Five

## 1.0.0 (2016-12-30)

- Spun off raspi-io into raspi-io-core
- Reworked this module so that [Raspi.js](https://github.com/nebrius/raspi) is passed in to the constructor of raspi-io-core
  - The idea is that raspi-io will pass raspi.js to this module.

_Note:_ this codebase derives from the [Raspi IO](https://github.com/nebrius/raspi-io) codebase, so consider the [raspi-io changelog](https://github.com/nebrius/raspi-io/blob/master/CHANGELOG.md) to be historically precede this changelog up to version 7.1.0 of raspi-io.
