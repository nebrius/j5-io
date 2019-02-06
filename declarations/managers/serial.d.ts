/// <reference types="node" />
import { ISerialModule } from 'core-io-types';
import { ISerialConfig, Handler } from 'abstract-io';
import { EventEmitter } from 'events';
declare enum Action {
    Write = 0,
    Close = 1,
    Flush = 2,
    Config = 3,
    Read = 4,
    Stop = 5
}
interface IQueueItem {
    type: Action;
}
export declare class SerialPortManager {
    isOpen: boolean;
    readonly baudrate: number;
    private serial;
    private actionQueue;
    private isSerialProcessing;
    private portId;
    private module;
    private eventEmitter;
    constructor(portId: string | number, serialModule: ISerialModule, globalEventEmitter: EventEmitter);
    reset(): void;
    addToSerialQueue(action: IQueueItem): void;
    private serialPump;
}
export declare class SerialManager {
    private module;
    private serialPortManagers;
    private eventEmitter;
    constructor(serialModule: ISerialModule, globalEventEmitter: EventEmitter);
    reset(): void;
    serialConfig({ portId, baud, rxPin, txPin }: ISerialConfig): void;
    serialWrite(portId: string | number, inBytes: number[]): void;
    serialRead(portId: number | string, maxBytesToReadOrHandler: Handler<number[]> | number, handlerOrUndefined?: Handler<number[]>): void;
    serialStop(portId: number | string): void;
    serialClose(portId: number | string): void;
    serialFlush(portId: number | string): void;
    private ensureManager;
}
export {};
