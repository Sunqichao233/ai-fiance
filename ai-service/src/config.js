const dotenv = require('dotenv');

dotenv.config();

const toInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

module.exports = {
  port: toInt(process.env.PORT, 4100),
  pushWebhookUrl: process.env.PUSH_WEBHOOK_URL || '',
  pushWebhookToken: process.env.PUSH_WEBHOOK_TOKEN || '',
  defaultDispatch: (process.env.DEFAULT_DISPATCH || 'false').toLowerCase() === 'true',
  maxRows: toInt(process.env.MAX_ROWS, 2000)
};
