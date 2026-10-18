import React from 'react';
import ForgeReconciler, { Text, I18nProvider, useTranslation } from '@forge/react';

// Prebuilt bundle with the REAL @forge/react + @forge/bridge inlined. Its i18n
// has no bridge seam: it fetch()es ./__LOCALES__/i18n-info.json and
// ./__LOCALES__/<locale>.json relative to this page.
const Greeting = () => {
  const { t, ready } = useTranslation();
  return <Text>{ready ? 'i18n:' + t('greeting') : 'i18n-loading'}</Text>;
};
ForgeReconciler.render(<I18nProvider><Greeting /></I18nProvider>);
