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
  if (asNumber < 40000) return null; // avoid small numeric fields being mistaken for dates

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
  rawRows.slice(0, maxRows).forEach((row, index) => {
    const normalized = normalizeRow(row, index + 2); // +2 to account for 1-based index + header row
    if (normalized) {
      pushes.push(normalized);
    }
  });

  return {
    sheetName,
    totalRows: rawRows.length,
    parsed: pushes
  };
};

module.exports = {
  parseExcelBuffer
};
