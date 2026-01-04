# Node SQL Backup

Automated database backup tool with scheduling support for MySQL, PostgreSQL, and SQL Server.

## Quick Start

```bash
git clone https://github.com/marvents/node-sql-backup.git
cd node-sql-backup
pnpm install
cp .env.example .env
nano .env  # Edit with your database credentials
pnpm start
```

## Requirements

- Node.js 18+
- pnpm

## Configuration

Create `.env` file:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USERNAME=your_user
DB_PASSWORD=your_password
DB_TYPE=postgresql              # mysql | postgresql | sqlserver

BACKUP_PATH=./backups
BACKUP_SCHEDULE=0 2 * * *       # Daily at 2 AM (cron syntax)
RETENTION_DAYS=7
```

## Usage

### Development
```bash
pnpm dev
```

### Production
```bash
pnpm build
pnpm start
```

## Production with PM2

### Install PM2
```bash
npm install -g pm2
```

### Run
```bash
pm2 start dist/index.js --name db-backup
```

### Common Commands
```bash
pm2 status                # View status
pm2 logs db-backup        # View logs
pm2 restart db-backup     # Restart
pm2 stop db-backup        # Stop
pm2 startup               # Auto-start on boot
pm2 save                  # Save current list
```

### PM2 Configuration (Optional)

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'db-backup',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log'
  }]
};
```

Run with: `pm2 start ecosystem.config.js`

## Cron Schedule Examples

```
0 2 * * *       # Daily at 2 AM
0 */6 * * *     # Every 6 hours
0 0 * * 0       # Weekly on Sunday
*/30 * * * *    # Every 30 minutes
```

Use [crontab.guru](https://crontab.guru/) to create custom schedules.

## Logs

Application logs are stored in `./logs/backup.log`

```bash
tail -f logs/backup.log          # Follow logs
pm2 logs db-backup --lines 50    # PM2 logs
```

## Troubleshooting

**Permission denied?**
```bash
chmod 755 backups/
```

**Connection refused?**
- Verify database is running
- Check credentials in `.env`
- Ensure database port is correct (MySQL: 3306, PostgreSQL: 5432, SQL Server: 1433)

## License

MIT