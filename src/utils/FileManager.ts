import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './Logger';

export class FileManager {
  static ensureDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      Logger.info(`Created directory: ${dirPath}`);
    }
  }

  static cleanOldBackups(dirPath: string, retentionDays: number): void {
    const now = Date.now();
    const maxAge = retentionDays * 24 * 60 * 60 * 1000;

    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath);
    let deletedCount = 0;
    let freedSpace = 0;

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > maxAge) {
        freedSpace += stats.size;
        fs.unlinkSync(filePath);
        deletedCount++;
        Logger.info(`Deleted old backup: ${file} (${this.formatBytes(stats.size)})`);
      }
    });

    if (deletedCount > 0) {
      Logger.info(`Cleanup complete: ${deletedCount} files deleted, ${this.formatBytes(freedSpace)} freed`);
    }
  }

  static getDirectorySize(dirPath: string): number {
    let totalSize = 0;

    if (!fs.existsSync(dirPath)) return 0;

    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    });

    return totalSize;
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  static logStorageInfo(dirPath: string): void {
    const totalSize = this.getDirectorySize(dirPath);
    const fileCount = fs.existsSync(dirPath) ? fs.readdirSync(dirPath).length : 0;

    Logger.info(`Backup storage: ${fileCount} files, ${this.formatBytes(totalSize)} total`);
  }
}