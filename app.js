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
  try {
    console.log('Connecting');
    const response = await axios.get(`https://api.render.com/v1/services/${SERVICE_ID}/deploys`, {
      headers: { 'Authorization': `Bearer ${RENDER_API_KEY}` }
    });

    console.log(response);
    
    const latestDeploy = response.data[0];

    if (latestDeploy.status === 'failed') {
      const logs = await fetchBuildLogs(latestDeploy.id);
      await sendNotification(logs);
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

async function sendNotification(logs) {
  const message = {
    msg_type: "text",
    content: {
      text: `Render.com Build Failure\n\nThe latest build has failed. Here are the logs:\n\n${logs}`
    }
  };

  try {
    await axios.post(WEBHOOK_URL, message);
    console.log('Notification sent');
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// Schedule the check
cron.schedule(CHECK_INTERVAL, checkBuildStatus);

// Create a simple HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Render Log Forwarder is running');
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Render.com build status checker with integration is running...');
});
