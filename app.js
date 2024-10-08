const axios = require('axios');
const cron = require('node-cron');
const http = require('http');

// Configuration from environment variables
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const SERVICE_ID = process.env.RENDER_SERVICE_ID;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || '*/10 * * * *';
const PORT = process.env.PORT || 3000;

async function checkBuildStatus() {
  console.log('Checking build status...'); // Debug log
  try {
    const response = await axios.get(`https://api.render.com/v1/services/${SERVICE_ID}/deploys`, {
      headers: { 'Authorization': `Bearer ${RENDER_API_KEY}` }
    });

    const latestDeploy = response.data[0];

    if (latestDeploy.status === 'failed') {
      const logs = await fetchBuildLogs(latestDeploy.id);
      await sendWebhookNotification(logs);
    }
  } catch (error) {
    console.error('Error checking build status:', error);
  }
}

async function fetchBuildLogs(deployId) {
  const response = await axios.get(`https://api.render.com/v1/services/${SERVICE_ID}/deploys/${deployId}`, {
    headers: { 'Authorization': `Bearer ${RENDER_API_KEY}` }
  });
  return response.data.build.log;
}

async function sendWebhookNotification(logs) {
  const message = {
    msg_type: "text",
    content: {
      text: `Render.com Build Failure\n\nThe latest build has failed. Here are the logs:\n\n${logs}`
    }
  };

  try {
    await axios.post(WEBHOOK_URL, message);
    console.log('Webhook notification sent');
  } catch (error) {
    console.error('Error sending webhook notification:', error);
  }
}

// Schedule the check
const job = cron.schedule(CHECK_INTERVAL, checkBuildStatus, {
  scheduled: false
});

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Render Log Forwarder is running');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Render.com build status checker with webhook integration is running...');
  job.start(); // Start the cron job after the server is running
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully.');
  job.stop();
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
