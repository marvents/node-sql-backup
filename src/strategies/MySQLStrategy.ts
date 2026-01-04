import * as mysql from 'mysql2/promise';
import * as fs from 'fs';
import { IBackupStrategy, DatabaseConfig, BackupResult } from './IBackupStrategy';
import { Logger } from '../utils/Logger';

export class MySQLStrategy implements IBackupStrategy {
  async backup(config: DatabaseConfig, outputPath: string): Promise<BackupResult> {
    let connection: mysql.Connection | null = null;

    try {
      Logger.info('Starting MySQL backup...');

      connection = await mysql.createConnection({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${config.database}_${timestamp}.sql`;
      const fullPath = `${outputPath}/${filename}`;

      const writeStream = fs.createWriteStream(fullPath);

      writeStream.write(`-- MySQL Backup\n`);
      writeStream.write(`-- Database: ${config.database}\n`);
      writeStream.write(`-- Date: ${new Date().toISOString()}\n\n`);
      writeStream.write(`SET NAMES utf8mb4;\n`);
      writeStream.write(`SET FOREIGN_KEY_CHECKS=0;\n\n`);

      const [tables] = await connection.query<mysql.RowDataPacket[]>(
        'SHOW TABLES'
      );

      const tableKey = `Tables_in_${config.database}`;

      for (const tableRow of tables) {
        const tableName = tableRow[tableKey];
        Logger.info(`Backing up table: ${tableName}`);

        const [createTable] = await connection.query<mysql.RowDataPacket[]>(
          `SHOW CREATE TABLE \`${tableName}\``
        );

        writeStream.write(`-- Table: ${tableName}\n`);
        writeStream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
        writeStream.write(`${createTable[0]['Create Table']};\n\n`);

        const [rows] = await connection.query<mysql.RowDataPacket[]>(
          `SELECT * FROM \`${tableName}\``
        );

        if (rows.length > 0) {
          const columns = Object.keys(rows[0]);
          const columnsList = columns.map(col => `\`${col}\``).join(', ');

          writeStream.write(`-- Data for table: ${tableName}\n`);
          writeStream.write(`LOCK TABLES \`${tableName}\` WRITE;\n`);

          const batchSize = 100;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const values = batch.map(row => {
              const vals = columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'number') return val;
                if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
                return `'${String(val).replace(/'/g, "''")}'`;
              }).join(', ');
              return `(${vals})`;
            }).join(',\n  ');

            writeStream.write(`INSERT INTO \`${tableName}\` (${columnsList}) VALUES\n  ${values};\n`);
          }

          writeStream.write(`UNLOCK TABLES;\n\n`);
        }
      }

      writeStream.write(`SET FOREIGN_KEY_CHECKS=1;\n`);
      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const stats = fs.statSync(fullPath);
      Logger.info(`MySQL backup completed: ${fullPath} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: fullPath,
        size: stats.size
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`MySQL backup failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg
      };
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  }
}