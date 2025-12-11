const express = require('express');
const multer = require('multer');
const path = require('path');

const config = require('./config');
const { parseExcelBuffer } = require('./excel-parser');
const { dispatchPushes } = require('./push-dispatcher');

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

app.use(express.json());

const parseBoolean = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'boolean') return value;
  return `${value}`.toLowerCase() === 'true';
};

const shouldDispatch = (req) => {
  if (req.query.dispatch !== undefined) return parseBoolean(req.query.dispatch);
  if (req.body?.dispatch !== undefined) return parseBoolean(req.body.dispatch);
  return config.defaultDispatch;
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ai-service' });
});

app.post('/push/from-excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Use "file" field in form-data.' });
    }

    const ext = path.extname(req.file.originalname || '').toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      return res.status(400).json({ error: 'Unsupported file type. Please upload an Excel file.' });
    }

    const parsed = parseExcelBuffer(req.file.buffer, { maxRows: config.maxRows });
    const dispatchRequested = shouldDispatch(req);
    let dispatchResults = [];

    if (dispatchRequested) {
      dispatchResults = await dispatchPushes(parsed.parsed, {
        webhookUrl: config.pushWebhookUrl,
        token: config.pushWebhookToken
      });
    }

    res.json({
      sheetName: parsed.sheetName,
      totalRows: parsed.totalRows,
      parsedCount: parsed.parsed.length,
      dispatch: {
        requested: dispatchRequested,
        webhookUrl: dispatchRequested ? config.pushWebhookUrl : null,
        results: dispatchResults
      },
      pushes: parsed.parsed
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to process Excel file.' });
  }
});

app.use((err, _req, res, _next) => {
  // fallback error handler so unexpected errors do not crash the server
  const message = err?.message || 'Internal server error';
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`ai-service listening on port ${config.port}`);
});
