/*
Copyright (c) Bryan Hughes <bryan@nebri.us>

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

import { Mode } from 'abstract-io';
import { IPeripheral, IBaseModule } from 'core-io-types';

let baseModule: IBaseModule | null = null;

const modeMapping = new WeakMap<IPeripheral, Mode>();

export function setBaseModule(module: IBaseModule): void {
  baseModule = module;
}

export function getPeripheral(pin: number): IPeripheral | undefined {
  if (!baseModule) {
    throw new Error(`Internal Error: "getPeripheral" method called without base module being set`);
  }
  return baseModule.getActivePeripheral(pin);
}

export function getPeripherals(): { [ pin: number ]: IPeripheral } {
  if (!baseModule) {
    throw new Error(`Internal Error: "getPeripherals" method called without base module being set`);
  }
  return baseModule.getActivePeripherals();
}

export function getMode(peripheral: IPeripheral): Mode {
  const mode = modeMapping.get(peripheral);
  if (typeof mode !== 'number') {
    throw new Error(`Internal Error: tried to get the mode for an unknown peripheral`);
  }
  return mode;
}

export function setMode(peripheral: IPeripheral, mode: Mode): void {
  modeMapping.set(peripheral, mode);
}

export function normalizePin(pin: string | number): number {
  if (!baseModule) {
    throw new Error(`Internal Error: "normalizePin" method called without base module being set`);
  }
  const normalizedPin = baseModule.getPinNumber(pin);
  if (typeof normalizedPin !== 'number') {
    throw new Error(`Unknown pin "${pin}"`);
  }
  return normalizedPin;
}

export function constrain(value: number, min: number, max: number): number {
  return value > max ? max : value < min ? min : value;
}
