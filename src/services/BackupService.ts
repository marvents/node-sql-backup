import { IBackupStrategy } from '../strategies/IBackupStrategy';
import { MySQLStrategy } from '../strategies/MySQLStrategy';
import { PostgreSQLStrategy } from '../strategies/PostgreSQLStrategy';
import { AppConfig } from '../utils/Config';
import { Logger } from '../utils/Logger';
import { FileManager } from '../utils/FileManager';
import { SQLServerStrategy } from '../strategies/SQLServerStrategy';

export class BackupService {
  private strategy: IBackupStrategy;

  constructor(private config: AppConfig) {
    this.strategy = this.getStrategy(config.database.type);
  }

  private getStrategy(dbType: string): IBackupStrategy {
    switch (dbType) {
      case 'mysql':
        return new MySQLStrategy();
      case 'postgresql':
        return new PostgreSQLStrategy();
       case 'sqlserver':
         return new SQLServerStrategy();
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  async execute(): Promise<void> {
    try {
      Logger.info('=== Backup process started ===');

      FileManager.ensureDirectory(this.config.backup.path);

      const result = await this.strategy.backup(
        {
          ...this.config.database,
          database: this.config.database.name
        },
        this.config.backup.path
      );

      if (result.success) {
        Logger.info(`Backup successful! File: ${result.filePath}`);

        // تنظيف النسخ القديمة
        FileManager.cleanOldBackups(
          this.config.backup.path,
          this.config.backup.retentionDays
        );
      } else {
        Logger.error(`Backup failed: ${result.error}`);
      }

      Logger.info('=== Backup process completed ===');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Backup process error: ${errorMsg}`);
      throw error;
    }
  }
}