export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface BackupResult {
  success: boolean;
  filePath?: string;
  size?: number;
  error?: string;
}

export interface IBackupStrategy {
  backup(config: DatabaseConfig, outputPath: string): Promise<BackupResult>;
}