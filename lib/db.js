'use strict';

const { Client } = require('machcli');

function appError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function close(resource) {
  if (!resource) return;
  try {
    resource.close();
  } catch (_) {
    // Cleanup must continue so one failed close cannot leak the other resources.
    console.println('Warning: a database resource could not be closed.');
  }
}

function withConnection(config, work) {
  let client;
  let connection;
  try {
    try {
      client = new Client(config);
      connection = client.connect();
    } catch (_) {
      throw appError(503, 'DB_UNAVAILABLE', 'Database connection failed. Check NEO_APP_DB_* settings and whether Neo is running.');
    }
    return work(connection);
  } finally {
    close(connection);
    close(client);
  }
}

function queryAll(connection, sql, ...params) {
  let rows;
  try {
    rows = connection.query(sql, ...params);
    const result = [];
    for (const row of rows) result.push(row);
    return result;
  } finally {
    close(rows);
  }
}

function queryInfo(label, sql, params) {
  function dateLiteral(value) {
    let text;
    if (value && typeof value.getFullYear === 'function') {
      const part = (number, width) => String(number).padStart(width, '0');
      text = part(value.getFullYear(), 4) + '-' + part(value.getMonth() + 1, 2) + '-' + part(value.getDate(), 2) + ' ' +
        part(value.getHours(), 2) + ':' + part(value.getMinutes(), 2) + ':' + part(value.getSeconds(), 2) + '.' +
        part(value.getMilliseconds(), 3);
    } else {
      const match = String(value).match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(?: [+-]\d{4}(?: [A-Za-z]+)?)?$/);
      if (!match) return null;
      text = match[1] + '.' + (match[2] || '').padEnd(9, '0').slice(0, 9);
    }
    const pieces = text.split('.');
    const normalized = pieces[0] + '.' + (pieces[1] || '').padEnd(9, '0').slice(0, 9);
    return "TO_DATE('" + normalized + "', 'YYYY-MM-DD HH24:MI:SS.mmmuuunnn')";
  }

  let index = 0;
  const statement = String(sql).trim().replace(/\?/g, () => {
    const value = (params || [])[index++];
    if (value == null) return 'NULL';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'boolean') return value ? '1' : '0';
    const date = dateLiteral(value);
    if (date) return date;
    const text = value && typeof value.toISOString === 'function' ? value.toISOString() : String(value);
    return "'" + text.replace(/'/g, "''") + "'";
  });
  return {
    label,
    sql: statement
  };
}

module.exports = { appError, close, queryAll, queryInfo, withConnection };
