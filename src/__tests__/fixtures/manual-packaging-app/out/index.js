// TypeScript-compiled-style CommonJS — exactly what manual packaging uploads.
// Everything here is the point of the fixture: CJS require of @forge/*
// (bypasses the ESM loader hooks), a relative require, and a data file read
// via __dirname. None of this survives esbuild bundling; all of it must work
// when the package dir is loaded as-is.
'use strict';
const Resolver = require('@forge/resolver').default;
const { kvs } = require('@forge/kvs');
const fs = require('fs');
const path = require('path');
const { greeting } = require('./lib/helper.js');

const resolver = new Resolver();

resolver.define('getText', async () => {
  const data = fs.readFileSync(path.join(__dirname, 'data.txt'), 'utf8').trim();
  await kvs.set('manual-pkg-key', data);
  return `${greeting}: ${data}`;
});

module.exports.handler = resolver.getDefinitions();
