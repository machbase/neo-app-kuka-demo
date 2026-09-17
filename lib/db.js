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

module.exports = { appError, close, queryAll, withConnection };
