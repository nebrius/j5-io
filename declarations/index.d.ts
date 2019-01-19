import { IBaseModule, IGPIOModule, ILEDModule, IPWMModule, ISerialModule, II2CModule, IPeripheral, IPinInfo } from 'core-io-types';
import { AbstractIO, Value, Mode, IPinConfiguration, ISerialConfig } from 'abstract-io';
declare const serialPortIds: unique symbol;
declare const name: unique symbol;
declare const isReady: unique symbol;
declare const pins: unique symbol;
declare const defaultLed: unique symbol;
declare const gpioManager: unique symbol;
declare const ledManager: unique symbol;
export interface IOptions {
    pluginName: string;
    platform: {
        base: IBaseModule;
        gpio: IGPIOModule;
        pwm: IPWMModule;
        led?: ILEDModule;
        serial?: ISerialModule;
        i2c?: II2CModule;
    };
    serialIds?: {
        [id: string]: any;
    };
    pinInfo: {
        [pin: number]: IPinInfo;
    };
}
export declare class CoreIO extends AbstractIO {
    readonly defaultLed: number | undefined;
    readonly name: string;
    readonly SERIAL_PORT_IDs: {
        [id: string]: any;
    };
    readonly pins: ReadonlyArray<IPinConfiguration>;
    readonly analogPins: ReadonlyArray<number>;
    readonly isReady: boolean;
    getInternalPinInstances?: () => {
        [pin: number]: IPeripheral;
    };
    getI2CInstance?: () => void;
    private [serialPortIds];
    private [isReady];
    private [pins];
    private [name];
    private [defaultLed];
    private [gpioManager];
    private [ledManager]?;
    constructor(options: IOptions);
    reset(): void;
    normalize(pin: number | string): number;
    pinMode(pin: string | number, mode: Mode): void;
    digitalRead(pin: string | number, handler: (value: Value) => void): void;
    digitalWrite(pin: string | number, value: number): void;
    serialConfig(options: ISerialConfig): void;
}
export {};
