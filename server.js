const express = require('express');
const bodyParser = require('body-parser');
const usersRoutes = require('./routes/users');
const recordingRoutes = require('./routes/recordings')
const cors = require('cors');
const pm2 = require('pm2');
const app = express();
const port = 3000;

app.use(cors({
    origin: '*', // Allow all domains (for development)
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allow the methods you need
    allowedHeaders: ['Content-Type', 'Authorization'], // Allow the headers you need
    credentials: true,
  }));
app.use(bodyParser.json());

// Use the routes 
app.use('/users', usersRoutes);
app.use('/recordings', recordingRoutes);
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

const logPattern = 'Failed to connect to fwh-dbserver.database.windows.net:1433';
pm2.connect((err) => {
  if (err) {
      console.error('Failed to connect to PM2:', err);
      return;
  }

  console.log('Connected to PM2. Watching logs for pattern:', logPattern);

  pm2.launchBus((err, bus) => {
      if (err) {
          console.error('Failed to launch PM2 bus:', err);
          return pm2.disconnect();
      }

      bus.on('log:out', (logData) => {
          if (logData.data.includes(logPattern)) {
              console.log('Pattern detected in logs. Restarting server...');
              pm2.restart(logData.process.name, (err) => {
                  if (err) {
                      console.error('Failed to restart server:', err);
                  } else {
                      console.log('Server restarted successfully.');
                  }
              });
          }
      });
  });
});