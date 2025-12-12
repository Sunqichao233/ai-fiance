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

const parseFormat = (req) => {
  const v = (req.query.format ?? req.body?.format ?? 'json');
  const s = `${v}`.trim().toLowerCase();
  return ['json', 'markdown', 'html', 'text'].includes(s) ? s : 'json';
};

const summarizeDispatch = (results = []) => {
  const summary = { sent: 0, failed: 0, skipped: 0 };
  for (const r of results) {
    if (r.status === 'sent') summary.sent++;
    else if (r.status === 'failed') summary.failed++;
    else if (r.status === 'skipped') summary.skipped++;
  }
  return summary;
};

const toReadable = ({ meta }, format) => {
  if (format === 'markdown') {
    const lines = [];
    if (meta?.segment) lines.push(`- 细分领域: ${meta.segment}`);
    if (meta?.company) lines.push(`- 公司: ${meta.company}`);
    if (meta?.ticker) lines.push(`- 代码: ${meta.ticker}`);
    if (meta?.fiscalPeriod) lines.push(`- 财年: ${meta.fiscalPeriod}`);
    if (meta?.grossMargin !== undefined && meta.grossMargin !== null) lines.push(`- 毛利率: ${meta.grossMargin}%`);
    if (meta?.netMargin !== undefined && meta.netMargin !== null) lines.push(`- 净利率: ${meta.netMargin}%`);
    if (meta?.arDays !== undefined && meta.arDays !== null) lines.push(`- 应收账款周转天数: ${meta.arDays}`);
    if (meta?.inventoryDays !== undefined && meta.inventoryDays !== null) lines.push(`- 存货周转天数: ${meta.inventoryDays}`);
    if (meta?.debtRatio !== undefined && meta.debtRatio !== null) lines.push(`- 资产负债率: ${meta.debtRatio}%`);
    if (meta?.revenueGrowth !== undefined && meta.revenueGrowth !== null) lines.push(`- 营收增长率: ${meta.revenueGrowth}%`);
    if (meta?.reportUrl) lines.push(`- 年报链接: ${meta.reportUrl}`);
    if (meta?.website) lines.push(`- 官网: ${meta.website}`);
    if (meta?.sourcePage) lines.push(`- 来源: ${meta.sourcePage}`);
    return lines.join('\n');
  }
  if (format === 'html') {
    const items = [];
    if (meta?.segment) items.push(`<li>细分领域: ${meta.segment}</li>`);
    if (meta?.company) items.push(`<li>公司: ${meta.company}</li>`);
    if (meta?.ticker) items.push(`<li>代码: ${meta.ticker}</li>`);
    if (meta?.fiscalPeriod) items.push(`<li>财年: ${meta.fiscalPeriod}</li>`);
    if (meta?.grossMargin !== undefined && meta.grossMargin !== null) items.push(`<li>毛利率: ${meta.grossMargin}%</li>`);
    if (meta?.netMargin !== undefined && meta.netMargin !== null) items.push(`<li>净利率: ${meta.netMargin}%</li>`);
    if (meta?.arDays !== undefined && meta.arDays !== null) items.push(`<li>应收账款周转天数: ${meta.arDays}</li>`);
    if (meta?.inventoryDays !== undefined && meta.inventoryDays !== null) items.push(`<li>存货周转天数: ${meta.inventoryDays}</li>`);
    if (meta?.debtRatio !== undefined && meta.debtRatio !== null) items.push(`<li>资产负债率: ${meta.debtRatio}%</li>`);
    if (meta?.revenueGrowth !== undefined && meta.revenueGrowth !== null) items.push(`<li>营收增长率: ${meta.revenueGrowth}%</li>`);
    if (meta?.reportUrl) items.push(`<li>年报链接: <a href="${meta.reportUrl}" target="_blank">${meta.reportUrl}</a></li>`);
    if (meta?.website) items.push(`<li>官网: <a href="${meta.website}" target="_blank">${meta.website}</a></li>`);
    if (meta?.sourcePage) items.push(`<li>来源: ${meta.sourcePage}</li>`);
    return `<ul>${items.join('')}</ul>`;
  }
  const lines = [];
  if (meta?.segment) lines.push(`细分领域: ${meta.segment}`);
  if (meta?.company) lines.push(`公司: ${meta.company}`);
  if (meta?.ticker) lines.push(`代码: ${meta.ticker}`);
  if (meta?.fiscalPeriod) lines.push(`财年: ${meta.fiscalPeriod}`);
  if (meta?.grossMargin !== undefined && meta.grossMargin !== null) lines.push(`毛利率: ${meta.grossMargin}%`);
  if (meta?.netMargin !== undefined && meta.netMargin !== null) lines.push(`净利率: ${meta.netMargin}%`);
  if (meta?.arDays !== undefined && meta.arDays !== null) lines.push(`应收账款周转天数: ${meta.arDays}`);
  if (meta?.inventoryDays !== undefined && meta.inventoryDays !== null) lines.push(`存货周转天数: ${meta.inventoryDays}`);
  if (meta?.debtRatio !== undefined && meta.debtRatio !== null) lines.push(`资产负债率: ${meta.debtRatio}%`);
  if (meta?.revenueGrowth !== undefined && meta.revenueGrowth !== null) lines.push(`营收增长率: ${meta.revenueGrowth}%`);
  if (meta?.reportUrl) lines.push(`年报链接: ${meta.reportUrl}`);
  if (meta?.website) lines.push(`官网: ${meta.website}`);
  if (meta?.sourcePage) lines.push(`来源: ${meta.sourcePage}`);
  return lines.join('\n');
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
    const format = parseFormat(req);
    let dispatchResults = [];

    if (dispatchRequested) {
      dispatchResults = await dispatchPushes(parsed.parsed, {
        webhookUrl: config.pushWebhookUrl,
        token: config.pushWebhookToken
      });
    }
    if (format === 'json') {
      return res.json({
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
    }
    const summary = summarizeDispatch(dispatchResults);
    if (format === 'markdown') {
      let md = `# 推送预览\n\n`;
      md += `- 工作表: ${parsed.sheetName}\n`;
      md += `- 总行数: ${parsed.totalRows}\n`;
      md += `- 解析条数: ${parsed.parsed.length}\n`;
      md += `- 派发: ${dispatchRequested ? '已请求' : '未请求'}\n`;
      md += `- 结果统计: sent=${summary.sent}, failed=${summary.failed}, skipped=${summary.skipped}\n\n`;
      parsed.parsed.forEach((p, i) => {
        md += `## ${i + 1}. ${p.title || '无标题'}\n\n`;
        if (p.meta) md += toReadable(p, 'markdown') + `\n\n`;
        if (p.body) md += `内容:\n\n\`\`\`\n${p.body}\n\`\`\`\n\n`;
      });
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      return res.send(md);
    }
    if (format === 'html') {
      let html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>推送预览</title><style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;padding:16px;line-height:1.6}h1{margin-top:0}h2{margin:16px 0 8px}pre{background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto}</style><body>`;
      html += `<h1>推送预览</h1>`;
      html += `<p>工作表: ${parsed.sheetName} | 总行数: ${parsed.totalRows} | 解析条数: ${parsed.parsed.length} | 派发: ${dispatchRequested ? '已请求' : '未请求'} | 结果统计: sent=${summary.sent}, failed=${summary.failed}, skipped=${summary.skipped}</p>`;
      parsed.parsed.forEach((p, i) => {
        html += `<h2>${i + 1}. ${p.title || '无标题'}</h2>`;
        if (p.meta) html += toReadable(p, 'html');
        if (p.body) html += `<h3>内容</h3><pre>${p.body.replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</pre>`;
      });
      html += `</body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }
    let txt = '';
    txt += `工作表: ${parsed.sheetName}\n`;
    txt += `总行数: ${parsed.totalRows}\n`;
    txt += `解析条数: ${parsed.parsed.length}\n`;
    txt += `派发: ${dispatchRequested ? '已请求' : '未请求'}\n`;
    txt += `结果统计: sent=${summary.sent}, failed=${summary.failed}, skipped=${summary.skipped}\n\n`;
    parsed.parsed.forEach((p, i) => {
      txt += `${i + 1}. ${p.title || '无标题'}\n`;
      if (p.meta) txt += toReadable(p, 'text') + `\n`;
      if (p.body) txt += `内容:\n${p.body}\n`;
      txt += `\n`;
    });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(txt);
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
