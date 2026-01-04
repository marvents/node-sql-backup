import * as dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  database: {
    host: string;
    port: number;
    name: string;
    username: string;
    password: string;
    type: 'mysql' | 'postgresql' | 'sqlserver';
  };
  backup: {
    path: string;
    schedule: string;
    retentionDays: number;
  };
}

export class Config {
  static load(): AppConfig {
    return {
      database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        name: process.env.DB_NAME || '',
        username: process.env.DB_USERNAME || '',
        password: process.env.DB_PASSWORD || '',
        type: (process.env.DB_TYPE as any) || 'mysql'
      },
      backup: {
        path: process.env.BACKUP_PATH || './backups',
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
        retentionDays: parseInt(process.env.RETENTION_DAYS || '7')
      }
    };
  }

  static validate(config: AppConfig): void {
    if (!config.database.name) throw new Error('DB_NAME is required');
    if (!config.database.username) throw new Error('DB_USERNAME is required');
    if (!['mysql', 'postgresql', 'sqlserver'].includes(config.database.type)) {
      throw new Error('Invalid DB_TYPE');
    }
  }
}