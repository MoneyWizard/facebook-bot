module.exports = {
  apps: [
    {
      name: 'facebook-bot-engine',
      script: 'src/server/app.js',
      cwd: 'D:/facebook-bot',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3500,
      },
    },
  ],
};
