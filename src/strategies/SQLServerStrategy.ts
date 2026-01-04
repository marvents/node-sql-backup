import * as sql from 'mssql';
import * as fs from 'fs';
import { IBackupStrategy, DatabaseConfig, BackupResult } from './IBackupStrategy';
import { Logger } from '../utils/Logger';

export class SQLServerStrategy implements IBackupStrategy {
  async backup(config: DatabaseConfig, outputPath: string): Promise<BackupResult> {
    let pool: sql.ConnectionPool | null = null;

    try {
      Logger.info('Starting SQL Server backup...');

      const sqlConfig: sql.config = {
        server: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        options: {
          encrypt: false,
          trustServerCertificate: true
        }
      };

      pool = await sql.connect(sqlConfig);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${config.database}_${timestamp}.sql`;
      const fullPath = `${outputPath}/${filename}`;

      const writeStream = fs.createWriteStream(fullPath);

      writeStream.write(`-- SQL Server Backup\n`);
      writeStream.write(`-- Database: ${config.database}\n`);
      writeStream.write(`-- Date: ${new Date().toISOString()}\n\n`);
      writeStream.write(`USE [${config.database}];\nGO\n\n`);

      const tablesResult = await pool.request().query(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_NAME
      `);

      for (const row of tablesResult.recordset) {
        const tableName = row.TABLE_NAME;
        Logger.info(`Backing up table: ${tableName}`);

        const columnsResult = await pool.request().query(`
          SELECT
            COLUMN_NAME,
            DATA_TYPE,
            CHARACTER_MAXIMUM_LENGTH,
            IS_NULLABLE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = '${tableName}'
          ORDER BY ORDINAL_POSITION
        `);

        writeStream.write(`\n-- Table: ${tableName}\n`);
        writeStream.write(`IF OBJECT_ID('[${tableName}]', 'U') IS NOT NULL DROP TABLE [${tableName}];\nGO\n`);
        writeStream.write(`CREATE TABLE [${tableName}] (\n`);

        const columnDefs = columnsResult.recordset.map((col, idx) => {
          let def = `  [${col.COLUMN_NAME}] ${col.DATA_TYPE}`;
          if (col.CHARACTER_MAXIMUM_LENGTH) {
            def += `(${col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH})`;
          }
          def += col.IS_NULLABLE === 'NO' ? ' NOT NULL' : ' NULL';
          return def + (idx < columnsResult.recordset.length - 1 ? ',' : '');
        }).join('\n');

        writeStream.write(columnDefs);
        writeStream.write(`\n);\nGO\n\n`);

        const dataResult = await pool.request().query(`SELECT * FROM [${tableName}]`);

        if (dataResult.recordset.length > 0) {
          const columns = Object.keys(dataResult.recordset[0]);
          const columnsList = columns.map(col => `[${col}]`).join(', ');

          writeStream.write(`-- Data for table: ${tableName}\n`);
          writeStream.write(`SET IDENTITY_INSERT [${tableName}] ON;\nGO\n`);

          const batchSize = 100;
          for (let i = 0; i < dataResult.recordset.length; i += batchSize) {
            const batch = dataResult.recordset.slice(i, i + batchSize);
            const values = batch.map(row => {
              const vals = columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'boolean') return val ? '1' : '0';
                if (typeof val === 'number') return val;
                if (val instanceof Date) return `'${val.toISOString().slice(0, 23)}'`;
                if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
                return `'${String(val).replace(/'/g, "''")}'`;
              }).join(', ');
              return `(${vals})`;
            }).join(',\n  ');

            writeStream.write(`INSERT INTO [${tableName}] (${columnsList}) VALUES\n  ${values};\nGO\n`);
          }

          writeStream.write(`SET IDENTITY_INSERT [${tableName}] OFF;\nGO\n\n`);
        }
      }

      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const stats = fs.statSync(fullPath);
      Logger.info(`SQL Server backup completed: ${fullPath} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: fullPath,
        size: stats.size
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`SQL Server backup failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg
      };
    } finally {
      if (pool) {
        await pool.close();
      }
    }
  }
}