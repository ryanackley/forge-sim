/**
 * Registration entry point for the module loader hooks.
 * 
 * Usage: node --import forge-sim/dist/loader/register.js your-app.js
 */

import { register } from 'node:module';

register('./hooks.js', import.meta.url);
