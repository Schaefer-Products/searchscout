import { environment } from '../../environments/environment';

export class Logger {
    static debug(...args: any[]): void {
        if (!environment.production) {
            console.debug(...args);
        }
    }

    static log(...args: any[]): void {
        if (!environment.production) {
            console.log(...args);
        }
    }

    static warn(...args: any[]): void {
        console.warn(...args);
    }

    static error(...args: any[]): void {
        console.error(...args);
    }
}