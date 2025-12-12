const XLSX = require('xlsx');

const FIELD_ALIASES = {
  title: ['title', '标题'],
  body: ['body', 'content', '内容', '文本'],
  audience: ['audience', 'target', 'recipient', '用户', '人群', '推送对象'],
  sendAt: ['sendat', 'send_at', 'time', '日期', '发送时间', '时间']
};

const normalizeKey = (key) => key?.toString().trim().toLowerCase() || '';

const pickFirst = (row, aliases) => {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && `${value}`.trim() !== '') {
      return value;
    }
  }
  return null;
};

const excelNumberToDate = (value) => {
  const asNumber = Number(value);
  if (Number.isNaN(asNumber)) return null;
  if (asNumber < 40000) return null;
  const parsed = XLSX.SSF.parse_date_code(asNumber);
  if (!parsed) return null;
  return new Date(
    Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0)
  );
};

const parseSendAt = (raw) => {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const excelDate = excelNumberToDate(raw);
  if (excelDate) return excelDate;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toNumberOrNull = (raw) => {
  if (raw === undefined || raw === null) return null;
  const s = `${raw}`.trim();
  if (!s) return null;
  if (s === '未披露' || s.startsWith('无')) return null;
  const n = Number(s.replace(/[,，]/g, '').replace(/%/g, ''));
  return Number.isNaN(n) ? null : n;
};

const normalizeFinancialRow = (rawRow, rowNumber, ctx) => {
  const row = {};
  Object.entries(rawRow || {}).forEach(([key, value]) => {
    row[normalizeKey(key)] = value;
  });
  const segment = `${row['细分领域'] || ctx.segment || ''}`.trim();
  const company = `${row['公司名称'] || ctx.company || ''}`.trim();
  const ticker = `${row['交易所/代码'] || ctx.ticker || ''}`.trim();
  const website = `${row['官方公司网站链接（可点击）'] || ctx.website || ''}`.trim();
  const reportUrl = `${row['官方年报pdf链接'] || ctx.reportUrl || ''}`.trim();
  if (segment) ctx.segment = segment;
  if (company) ctx.company = company;
  if (ticker) ctx.ticker = ticker;
  if (website) ctx.website = website;
  if (reportUrl) ctx.reportUrl = reportUrl;
  const fiscalPeriod = `${row['年报年度（财年）'] || ''}`.trim();
  const grossMarginRaw = `${row['毛利率 (%)'] || ''}`.trim();
  const netMarginRaw = `${row['净利率 (%)'] || ''}`.trim();
  const arDaysRaw = `${row['应收账款周转天数（天）'] || ''}`.trim();
  const inventoryDaysRaw = `${row['存货周转天数（天）'] || ''}`.trim();
  const debtRatioRaw = `${row['资产负债率（%)'] || ''}`.trim();
  const revenueGrowthRaw = `${row['营收增长率（%)'] || ''}`.trim();
  const sourcePage = `${row['数据来源页'] || ''}`.trim();
  const isHeaderRepeat = company === '公司名称' || segment === '细分领域';
  if (isHeaderRepeat) return null;
  const hasCore = fiscalPeriod || grossMarginRaw || netMarginRaw || arDaysRaw || inventoryDaysRaw || debtRatioRaw || revenueGrowthRaw;
  if (!hasCore) return null;
  const title = [company, fiscalPeriod].filter(Boolean).join(' | ');
  const parts = [];
  if (segment) parts.push(`细分领域: ${segment}`);
  if (ticker) parts.push(`代码: ${ticker}`);
  if (fiscalPeriod) parts.push(`财年: ${fiscalPeriod}`);
  if (grossMarginRaw) parts.push(`毛利率: ${grossMarginRaw}%`.replace('%%', '%'));
  if (netMarginRaw) parts.push(`净利率: ${netMarginRaw}%`.replace('%%', '%'));
  if (arDaysRaw) parts.push(`应收账款周转天数: ${arDaysRaw}`);
  if (inventoryDaysRaw) parts.push(`存货周转天数: ${inventoryDaysRaw}`);
  if (debtRatioRaw) parts.push(`资产负债率: ${debtRatioRaw}%`.replace('%%', '%'));
  if (revenueGrowthRaw) parts.push(`营收增长率: ${revenueGrowthRaw}%`.replace('%%', '%'));
  if (reportUrl) parts.push(`年报链接: ${reportUrl}`);
  if (website) parts.push(`官网: ${website}`);
  if (sourcePage) parts.push(`来源: ${sourcePage}`);
  return {
    rowNumber,
    title,
    body: parts.join('\n'),
    audience: 'all',
    sendAt: null,
    meta: {
      segment,
      company,
      ticker,
      website,
      reportUrl,
      fiscalPeriod,
      grossMargin: toNumberOrNull(grossMarginRaw) ?? null,
      netMargin: toNumberOrNull(netMarginRaw) ?? null,
      arDays: toNumberOrNull(arDaysRaw) ?? null,
      inventoryDays: toNumberOrNull(inventoryDaysRaw) ?? null,
      debtRatio: toNumberOrNull(debtRatioRaw) ?? null,
      revenueGrowth: toNumberOrNull(revenueGrowthRaw) ?? null,
      sourcePage
    }
  };
};

const normalizeRow = (rawRow, rowNumber) => {
  const lowerCaseRow = {};
  Object.entries(rawRow || {}).forEach(([key, value]) => {
    lowerCaseRow[normalizeKey(key)] = value;
  });
  const title = pickFirst(lowerCaseRow, FIELD_ALIASES.title);
  const body = pickFirst(lowerCaseRow, FIELD_ALIASES.body);
  if (!title && !body) {
    return null;
  }
  const audience = pickFirst(lowerCaseRow, FIELD_ALIASES.audience) || 'all';
  const sendAt = parseSendAt(pickFirst(lowerCaseRow, FIELD_ALIASES.sendAt));
  return {
    rowNumber,
    title: `${title || ''}`.trim(),
    body: `${body || ''}`.trim(),
    audience: `${audience}`.trim(),
    sendAt: sendAt ? sendAt.toISOString() : null
  };
};

const isFinancialSchema = (rows) => {
  if (!rows || rows.length === 0) return false;
  const sample = rows[0];
  const keys = Object.keys(sample || {}).map((k) => normalizeKey(k));
  const required = ['公司名称', '细分领域', '年报年度（财年）', '毛利率 (%)', '净利率 (%)'];
  return required.every((k) => keys.includes(k));
};

const parseExcelBuffer = (buffer, opts = {}) => {
  const { maxRows = 2000 } = opts;
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) {
    throw new Error('No sheet found in the uploaded file.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const pushes = [];
  if (isFinancialSchema(rawRows)) {
    const ctx = {};
    rawRows.slice(0, maxRows).forEach((row, index) => {
      const normalized = normalizeFinancialRow(row, index + 2, ctx);
      if (normalized) pushes.push(normalized);
    });
  } else {
    rawRows.slice(0, maxRows).forEach((row, index) => {
      const normalized = normalizeRow(row, index + 2);
      if (normalized) pushes.push(normalized);
    });
  }
  return {
    sheetName,
    totalRows: rawRows.length,
    parsed: pushes
  };
};

module.exports = {
  parseExcelBuffer
};
