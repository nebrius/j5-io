import { ILEDModule, ILED } from 'core-io-types';
import { Value } from 'abstract-io';
export declare const DEFAULT_LED_PIN = -1;
export declare class LEDManager {
    led: ILED;
    private value;
    constructor(ledModule: ILEDModule);
    reset(): void;
    digitalWrite(value: Value): void;
    getCurrentValue(): Value;
}
