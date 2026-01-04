import { Client } from 'pg';
import * as fs from 'fs';
import { IBackupStrategy, DatabaseConfig, BackupResult } from './IBackupStrategy';
import { Logger } from '../utils/Logger';

export class PostgreSQLStrategy implements IBackupStrategy {
  async backup(config: DatabaseConfig, outputPath: string): Promise<BackupResult> {
    let client: Client | null = null;

    try {
      Logger.info('Starting PostgreSQL backup...');

      client = new Client({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database
      });

      await client.connect();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${config.database}_${timestamp}.sql`;
      const fullPath = `${outputPath}/${filename}`;

      const writeStream = fs.createWriteStream(fullPath);

      writeStream.write(`-- PostgreSQL Backup\n`);
      writeStream.write(`-- Database: ${config.database}\n`);
      writeStream.write(`-- Date: ${new Date().toISOString()}\n\n`);
      writeStream.write(`SET client_encoding = 'UTF8';\n`);
      writeStream.write(`SET standard_conforming_strings = on;\n\n`);

      const tablesResult = await client.query(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `);

      for (const row of tablesResult.rows) {
        const tableName = row.tablename;
        Logger.info(`Backing up table: ${tableName}`);

        const createTableResult = await client.query(`
          SELECT
            'CREATE TABLE ' || quote_ident(tablename) || ' (' ||
            string_agg(
              quote_ident(attname) || ' ' ||
              format_type(atttypid, atttypmod) ||
              CASE WHEN attnotnull THEN ' NOT NULL' ELSE '' END,
              ', '
            ) || ');' as create_statement
          FROM pg_attribute a
          JOIN pg_class c ON a.attrelid = c.oid
          JOIN pg_namespace n ON c.relnamespace = n.oid
          WHERE c.relname = $1
            AND n.nspname = 'public'
            AND a.attnum > 0
            AND NOT a.attisdropped
          GROUP BY tablename
        `, [tableName]);

        writeStream.write(`\n-- Table: ${tableName}\n`);
        writeStream.write(`DROP TABLE IF EXISTS "${tableName}" CASCADE;\n`);

        if (createTableResult.rows.length > 0) {
          writeStream.write(`${createTableResult.rows[0].create_statement}\n\n`);
        }

        const dataResult = await client.query(`SELECT * FROM "${tableName}"`);

        if (dataResult.rows.length > 0) {
          const columns = dataResult.fields.map(f => f.name);
          const columnsList = columns.map(col => `"${col}"`).join(', ');

          writeStream.write(`-- Data for table: ${tableName}\n`);

          const batchSize = 100;
          for (let i = 0; i < dataResult.rows.length; i += batchSize) {
            const batch = dataResult.rows.slice(i, i + batchSize);
            const values = batch.map(row => {
              const vals = columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'boolean') return val ? 'true' : 'false';
                if (typeof val === 'number') return val;
                if (val instanceof Date) return `'${val.toISOString()}'`;
                if (Buffer.isBuffer(val)) return `'\\x${val.toString('hex')}'`;
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                return `'${String(val).replace(/'/g, "''")}'`;
              }).join(', ');
              return `(${vals})`;
            }).join(',\n  ');

            writeStream.write(`INSERT INTO "${tableName}" (${columnsList}) VALUES\n  ${values};\n`);
          }

          writeStream.write(`\n`);
        }
      }

      writeStream.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      const stats = fs.statSync(fullPath);
      Logger.info(`PostgreSQL backup completed: ${fullPath} (${stats.size} bytes)`);

      return {
        success: true,
        filePath: fullPath,
        size: stats.size
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`PostgreSQL backup failed: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg
      };
    } finally {
      if (client) {
        await client.end();
      }
    }
  }
}