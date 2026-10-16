// Manual-packaged backend: plain CJS, @forge/resolver kept EXTERNAL so the
// simulator's CJS interception can inject its shim (the supported shape).
// tsc-compiled app code reads the default export off the CJS namespace.
const Resolver = require('@forge/resolver').default;

const resolver = new Resolver();
resolver.define('getText', ({ payload }) => `from-manual-backend:${payload.from}`);

exports.handler = resolver.getDefinitions();
