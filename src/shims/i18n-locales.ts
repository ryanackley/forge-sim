/**
 * Mirror of @forge/i18n's ForgeSupportedLocaleCode. That package is only a
 * transitive dependency of the real @forge packages, so shims can't import
 * the type. Update from node_modules/@forge/i18n/out/constants.d.ts when the
 * contract suite (shim-contract-types.test.ts) flags it.
 */
export type ForgeSupportedLocaleCode =
  | 'zh-CN' | 'zh-TW' | 'cs-CZ' | 'da-DK' | 'nl-NL' | 'en-US' | 'en-GB'
  | 'et-EE' | 'fi-FI' | 'fr-FR' | 'de-DE' | 'hu-HU' | 'is-IS' | 'it-IT'
  | 'ja-JP' | 'ko-KR' | 'no-NO' | 'pl-PL' | 'pt-BR' | 'pt-PT' | 'ro-RO'
  | 'ru-RU' | 'sk-SK' | 'tr-TR' | 'es-ES' | 'sv-SE';
