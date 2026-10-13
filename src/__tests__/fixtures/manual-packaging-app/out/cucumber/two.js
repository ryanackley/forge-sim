// Nested-directory CJS web trigger handler — mirrors the packaging-standard
// doc example (handler "cucumber/two.run" → <package.path>/cucumber/two.js).
'use strict';
module.exports.run = () => ({
  statusCode: 200,
  headers: { 'Content-Type': ['text/plain'] },
  body: 'from-manual-package',
});
