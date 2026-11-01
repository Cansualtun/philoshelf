// Bilgi amaçlı. Canlı süreç deploy/start.sh + PM2 name=philoshelf-api ile çalışır.
module.exports = {
  apps: [
    {
      name: 'philoshelf-api',
      cwd: '/var/www/philoshelf/current',
      script: 'deploy/start.sh',
      interpreter: 'bash',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '150M',
    },
  ],
};
