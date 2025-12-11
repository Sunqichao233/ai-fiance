const axios = require('axios');

const dispatchPushes = async (pushes, { webhookUrl, token }) => {
  if (!Array.isArray(pushes) || pushes.length === 0) {
    return [];
  }

  if (!webhookUrl) {
    return pushes.map((push) => ({
      rowNumber: push.rowNumber,
      title: push.title,
      status: 'skipped',
      reason: 'PUSH_WEBHOOK_URL not configured'
    }));
  }

  const results = [];

  // send sequentially to keep the implementation simple and avoid overwhelming the target webhook
  for (const push of pushes) {
    try {
      const response = await axios.post(
        webhookUrl,
        {
          title: push.title,
          body: push.body,
          audience: push.audience,
          sendAt: push.sendAt
        },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        }
      );

      results.push({
        rowNumber: push.rowNumber,
        title: push.title,
        status: 'sent',
        statusCode: response.status
      });
    } catch (err) {
      results.push({
        rowNumber: push.rowNumber,
        title: push.title,
        status: 'failed',
        statusCode: err.response?.status,
        error: err.response?.data || err.message
      });
    }
  }

  return results;
};

module.exports = {
  dispatchPushes
};
