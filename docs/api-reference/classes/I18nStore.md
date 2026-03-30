[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / I18nStore

# Class: I18nStore

Defined in: i18n-store.ts:45

## Accessors

### hasTranslations

#### Get Signature

> **get** **hasTranslations**(): `boolean`

Defined in: i18n-store.ts:240

Whether any translations are available (loaded or overridden)

##### Returns

`boolean`

## Constructors

### Constructor

> **new I18nStore**(): `I18nStore`

#### Returns

`I18nStore`

## Methods

### clear()

> **clear**(): `void`

Defined in: i18n-store.ts:251

Clear everything

#### Returns

`void`

***

### createTranslationFunction()

> **createTranslationFunction**(`locale`): `Promise`\<(`key`, `defaultValue?`) => `string`\>

Defined in: i18n-store.ts:216

Create a translation function for a locale.
Mirrors @forge/bridge's i18n.createTranslationFunction().

#### Parameters

##### locale

`string`

#### Returns

`Promise`\<(`key`, `defaultValue?`) => `string`\>

***

### getAvailableLocales()

> **getAvailableLocales**(): `Promise`\<`string`[]\>

Defined in: i18n-store.ts:245

List available locales

#### Returns

`Promise`\<`string`[]\>

***

### getI18nInfoConfig()

> **getI18nInfoConfig**(): `Promise`\<[`I18nInfoConfig`](../interfaces/I18nInfoConfig.md)\>

Defined in: i18n-store.ts:105

#### Returns

`Promise`\<[`I18nInfoConfig`](../interfaces/I18nInfoConfig.md)\>

***

### getTranslationResource()

> **getTranslationResource**(`locale`): `Promise`\<[`TranslationResource`](../interfaces/TranslationResource.md)\>

Defined in: i18n-store.ts:139

#### Parameters

##### locale

`string`

#### Returns

`Promise`\<[`TranslationResource`](../interfaces/TranslationResource.md)\>

***

### getTranslations()

> **getTranslations**(`locale`, `options?`): `Promise`\<[`GetTranslationsResult`](../interfaces/GetTranslationsResult.md)\>

Defined in: i18n-store.ts:173

Get translations for a locale, with optional fallback.
Mirrors @forge/bridge's i18n.getTranslations() behavior.

#### Parameters

##### locale

`string`

##### options?

###### fallback

`boolean`

#### Returns

`Promise`\<[`GetTranslationsResult`](../interfaces/GetTranslationsResult.md)\>

***

### loadFromAppDir()

> **loadFromAppDir**(`appDir`): `boolean`

Defined in: i18n-store.ts:66

Load translations from a Forge app directory.
Looks for `__LOCALES__/` in the app's `src/` directory first,
then falls back to root.

#### Parameters

##### appDir

`string`

#### Returns

`boolean`

***

### setConfig()

> **setConfig**(`config`): `void`

Defined in: i18n-store.ts:98

Set i18n config programmatically.

#### Parameters

##### config

[`I18nInfoConfig`](../interfaces/I18nInfoConfig.md)

#### Returns

`void`

***

### setTranslations()

> **setTranslations**(`locale`, `translations`): `void`

Defined in: i18n-store.ts:91

Set translations programmatically (for tests or CLI overrides).

#### Parameters

##### locale

`string`

##### translations

[`TranslationResource`](../interfaces/TranslationResource.md)

#### Returns

`void`
