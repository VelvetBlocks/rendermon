const axios = require('axios');
const cron = require('node-cron');

// Configuration
const RENDER_API_KEY = process.env.RENDER_API_KEY;
const SERVICE_ID = process.env.RENDER_SERVICE_ID;
const CHECK_INTERVAL = '*/10 * * * *'; // Run every 10 minutes
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function checkBuildStatus() {
  try {
    const response = await axios.get(`https://api.render.com/v1/services/${SERVICE_ID}/deploys`, {
      headers: { 'Authorization': `Bearer ${RENDER_API_KEY}` }
    });

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
    console.log('The notification sent');
  } catch (error) {
    console.error('Error sending the notification:', error);
  }
}

// Schedule the check
cron.schedule(CHECK_INTERVAL, checkBuildStatus);

console.log('Render.com build status checker with integration is running...');
