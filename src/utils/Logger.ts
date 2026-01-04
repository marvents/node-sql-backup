import * as fs from 'fs';
import * as path from 'path';

enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private static logFile = './logs/backup.log';

  private static ensureLogDir(): void {
    const dir = path.dirname(this.logFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private static log(level: LogLevel, message: string): void {
    this.ensureLogDir();

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;

    console.log(logMessage.trim());

    fs.appendFileSync(this.logFile, logMessage);
  }

  static info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  static warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  static error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }
}