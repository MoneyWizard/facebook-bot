module.exports = {
  apps: [
    {
      name: 'facebook-bot-engine',
      script: 'src/server/app.js',
      cwd: 'D:/facebook-bot',
      watch: false,
      autorestart: true,
      max_restarts: 100,
      min_uptime: '15s',
      restart_delay: 4000,
      env: {
        NODE_ENV: 'production',
        PORT: 3500,
      },
    },
  ],
};
