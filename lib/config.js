'use strict';

const process = require('process');
const parseArgs = require('util/parseArgs');

function env(name, fallback) {
  const value = process.env.get(name);
  return value == null || value === '' ? fallback : value;
}

function integer(value, name, min, max) {
  const text = String(value);
  const number = Number(text);
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(name + ' must be an integer between ' + min + ' and ' + max);
  }
  return number;
}

function options(definitions) {
  return parseArgs(process.argv.slice(2), {
    options: Object.assign({ help: { type: 'boolean', short: 'h' } }, definitions || {}),
    strict: true,
    allowPositionals: false
  }).values;
}

function dbConfig() {
  return {
    host: env('NEO_APP_DB_HOST', '127.0.0.1'),
    port: integer(env('NEO_APP_DB_PORT', '5656'), 'NEO_APP_DB_PORT', 1, 65535),
    user: env('NEO_APP_DB_USER', 'sys'),
    password: env('NEO_APP_DB_PASSWORD', 'manager')
  };
}

module.exports = { dbConfig, integer, options };
