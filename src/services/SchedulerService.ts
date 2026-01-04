import * as cron from 'node-cron';
import { BackupService } from './BackupService';
import { Logger } from '../utils/Logger';

export class SchedulerService {
  private task: cron.ScheduledTask | null = null;

  constructor(
    private schedule: string,
    private backupService: BackupService
  ) {}

  start(): void {
    if (!cron.validate(this.schedule)) {
      throw new Error(`Invalid cron expression: ${this.schedule}`);
    }

    Logger.info(`Scheduler started with cron: ${this.schedule}`);

    this.task = cron.schedule(this.schedule, async () => {
      await this.backupService.execute();
    });
  }

  stop(): void {
    if (this.task) {
      this.task.stop();
      Logger.info('Scheduler stopped');
    }
  }

  async runNow(): Promise<void> {
    Logger.info('Manual backup triggered');
    await this.backupService.execute();
  }
}