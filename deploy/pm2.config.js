module.exports = {
  apps: [
    {
      name: 'superglazka-api',
      script: './server/server.js',
      cwd: '/var/www/superglazka',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/var/log/superglazka/err.log',
      out_file: '/var/log/superglazka/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_restarts: 5,
      min_uptime: '10s',
      restart_delay: 3000,
      watch: false,
      autorestart: true
    }
  ]
};
