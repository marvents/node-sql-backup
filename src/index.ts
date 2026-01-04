import { Config } from './utils/Config';
import { BackupService } from './services/BackupService';
import { SchedulerService } from './services/SchedulerService';
import { Logger } from './utils/Logger';

async function main() {
  try {
    const config = Config.load();
    Config.validate(config);

    Logger.info('Application started');
    Logger.info(`Database: ${config.database.type} - ${config.database.name}`);

    const backupService = new BackupService(config);
    const scheduler = new SchedulerService(config.backup.schedule, backupService);

    await scheduler.runNow();

    scheduler.start();

    Logger.info('✅ Backup service is running...');
    Logger.info(`Schedule: ${config.backup.schedule}`);

    process.on('SIGINT', () => {
      Logger.info('Shutting down gracefully...');
      scheduler.stop();
      process.exit(0);
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    Logger.error(`Fatal error: ${errorMsg}`);
    process.exit(1);
  }
}

main();