import React from 'react';
import ForgeReconciler, { Text } from '@forge/react';
// shared.js is a separate <script type="module"> listed BEFORE this one in
// global.html; a browser runs them in document order, so it must be visible.
ForgeReconciler.render(<Text>{'from-global-entry shared:' + (window.__sharedLoaded ?? 'missing')}</Text>);
