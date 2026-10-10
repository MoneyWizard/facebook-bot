'use strict';

const logger = require('./logger');

/**
 * Send real-time webhook alert (Discord/Slack/Telegram compatible).
 * Configured via DISCORD_WEBHOOK_URL in .env.
 *
 * @param {string} title
 * @param {string} description
 * @param {Array<{ name: string, value: string }>} [fields=[]]
 */
async function sendNotification(title, description, fields = []) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const payload = {
      embeds: [
        {
          title: `🤖 Facebook Bot: ${title}`,
          description,
          color: 0x00f0ff, // Cyber cyan
          fields,
          timestamp: new Date().toISOString(),
          footer: { text: 'HexNemesis Autonomous Growth Engine' },
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      logger.warn(`Failed to send Discord notification: ${res.statusText}`);
    } else {
      logger.debug(`Discord notification sent: ${title}`);
    }
  } catch (err) {
    logger.warn(`Notification error: ${err.message}`);
  }
}

module.exports = { sendNotification };
