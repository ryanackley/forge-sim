import React from 'react';
import ReactDOM from 'react-dom/client';
import AppProvider from '@atlaskit/app-provider';
import { App } from './App';

/**
 * Wrap the entire app in Atlaskit's AppProvider so all components
 * get proper theme tokens (colors, spacing, typography).
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  
    <AppProvider defaultColorMode="light">
      <App />
    </AppProvider>
 
);
