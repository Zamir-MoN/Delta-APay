module.exports = {
  apps: [
    {
      name: 'delta-apay-backend',
      script: 'npm',
      args: 'start',
      cwd: './backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
        // Add your production DB and GMAIL variables here or in .env
      }
    },
    {
      name: 'delta-apay-frontend',
      script: 'npm',
      args: 'start',
      cwd: './frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 4005,
      }
    }
  ]
};
