[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / ExternalAuthStore

# Class: ExternalAuthStore

Defined in: external-auth-store.ts:55

## Constructors

### Constructor

> **new ExternalAuthStore**(): `ExternalAuthStore`

#### Returns

`ExternalAuthStore`

## Methods

### buildAuthorizationUrl()

> **buildAuthorizationUrl**(`providerKey`, `redirectUri`, `state`): `string` \| `null`

Defined in: external-auth-store.ts:214

Build the authorization URL for a provider's OAuth flow.

#### Parameters

##### providerKey

`string`

##### redirectUri

`string`

##### state

`string`

#### Returns

`string` \| `null`

***

### clear()

> **clear**(): `void`

Defined in: external-auth-store.ts:541

#### Returns

`void`

***

### ensureValidToken()

> **ensureValidToken**(`providerKey`): `Promise`\<`ThirdPartyToken` \| `null`\>

Defined in: external-auth-store.ts:410

Ensure a token is valid, refreshing if needed.

#### Parameters

##### providerKey

`string`

#### Returns

`Promise`\<`ThirdPartyToken` \| `null`\>

***

### exchangeCode()

> **exchangeCode**(`providerKey`, `code`, `redirectUri`): `Promise`\<`ThirdPartyToken` \| `null`\>

Defined in: external-auth-store.ts:249

Exchange an authorization code for tokens.

#### Parameters

##### providerKey

`string`

##### code

`string`

##### redirectUri

`string`

#### Returns

`Promise`\<`ThirdPartyToken` \| `null`\>

***

### getAccount()

> **getAccount**(`providerKey`): `ExternalAuthAccount` \| `undefined`

Defined in: external-auth-store.ts:154

Get the external account info for a provider.

#### Parameters

##### providerKey

`string`

#### Returns

`ExternalAuthAccount` \| `undefined`

***

### getProvider()

> **getProvider**(`key`): `ManifestAuthProvider` \| `undefined`

Defined in: external-auth-store.ts:171

Get provider definition from manifest.

#### Parameters

##### key

`string`

#### Returns

`ManifestAuthProvider` \| `undefined`

***

### getProviderBaseUrl()

> **getProviderBaseUrl**(`providerKey`, `remoteName?`): `string` \| `undefined`

Defined in: external-auth-store.ts:192

Get the primary remote base URL for a provider (first remote in the list).

#### Parameters

##### providerKey

`string`

##### remoteName?

`string`

#### Returns

`string` \| `undefined`

***

### getRemoteBaseUrl()

> **getRemoteBaseUrl**(`remoteKey`): `string` \| `undefined`

Defined in: external-auth-store.ts:185

Resolve a remote's base URL.

#### Parameters

##### remoteKey

`string`

#### Returns

`string` \| `undefined`

***

### getSecret()

> **getSecret**(`providerKey`): `string` \| `undefined`

Defined in: external-auth-store.ts:205

Get the client secret for a provider.

#### Parameters

##### providerKey

`string`

#### Returns

`string` \| `undefined`

***

### getToken()

> **getToken**(`providerKey`): `ThirdPartyToken` \| `undefined`

Defined in: external-auth-store.ts:122

Get stored token for a provider.

#### Parameters

##### providerKey

`string`

#### Returns

`ThirdPartyToken` \| `undefined`

***

### hasCredentials()

> **hasCredentials**(`providerKey`, `scopes?`): `boolean`

Defined in: external-auth-store.ts:129

Check if a provider has valid credentials.

#### Parameters

##### providerKey

`string`

##### scopes?

`string`[]

#### Returns

`boolean`

***

### hasSecret()

> **hasSecret**(`providerKey`): `boolean`

Defined in: external-auth-store.ts:106

Check if a provider has a client secret configured.

#### Parameters

##### providerKey

`string`

#### Returns

`boolean`

***

### interactiveOAuthFlow()

> **interactiveOAuthFlow**(`providerKey`, `port?`): `Promise`\<`ThirdPartyToken` \| `null`\>

Defined in: external-auth-store.ts:434

Run an interactive OAuth flow: opens the browser, waits for callback,
exchanges code, stores token. Used by requestCredentials() at runtime.

Returns the token on success, null if the provider lacks a secret or
the flow is cancelled/fails.

#### Parameters

##### providerKey

`string`

##### port?

`number` = `19421`

#### Returns

`Promise`\<`ThirdPartyToken` \| `null`\>

***

### listAccounts()

> **listAccounts**(`providerKey`): `ExternalAuthAccount`[]

Defined in: external-auth-store.ts:161

List all accounts for a provider (in our sim, max 1 per provider).

#### Parameters

##### providerKey

`string`

#### Returns

`ExternalAuthAccount`[]

***

### listProviders()

> **listProviders**(): `ManifestAuthProvider`[]

Defined in: external-auth-store.ts:178

List all configured providers.

#### Returns

`ManifestAuthProvider`[]

***

### loadFromManifest()

> **loadFromManifest**(`providers`, `remotes`): `void`

Defined in: external-auth-store.ts:77

Load providers and remotes from a parsed manifest.

#### Parameters

##### providers

`Map`\<`string`, `ManifestAuthProvider`\>

##### remotes

`Map`\<`string`, `ManifestRemote`\>

#### Returns

`void`

***

### loadSecrets()

> **loadSecrets**(`secrets`): `void`

Defined in: external-auth-store.ts:95

Load secrets from a ProviderSecrets object (from disk).

#### Parameters

##### secrets

`ProviderSecrets`

#### Returns

`void`

***

### refreshToken()

> **refreshToken**(`providerKey`): `Promise`\<`ThirdPartyToken` \| `null`\>

Defined in: external-auth-store.ts:321

Refresh an expired token.

#### Parameters

##### providerKey

`string`

#### Returns

`Promise`\<`ThirdPartyToken` \| `null`\>

***

### retrieveProfile()

> **retrieveProfile**(`providerKey`, `accessToken`): `Promise`\<`ExternalAuthAccount` \| `undefined`\>

Defined in: external-auth-store.ts:378

Retrieve external account profile using the provider's retrieveProfile action.

#### Parameters

##### providerKey

`string`

##### accessToken

`string`

#### Returns

`Promise`\<`ExternalAuthAccount` \| `undefined`\>

***

### revokeToken()

> **revokeToken**(`providerKey`): `void`

Defined in: external-auth-store.ts:147

Remove token for a provider.

#### Parameters

##### providerKey

`string`

#### Returns

`void`

***

### setSecret()

> **setSecret**(`providerKey`, `clientSecret`): `void`

Defined in: external-auth-store.ts:88

Set the client secret for a provider.

#### Parameters

##### providerKey

`string`

##### clientSecret

`string`

#### Returns

`void`

***

### setToken()

> **setToken**(`providerKey`, `token`): `void`

Defined in: external-auth-store.ts:115

Set a token directly (for mock/manual mode).

#### Parameters

##### providerKey

`string`

##### token

`ThirdPartyToken`

#### Returns

`void`

## Properties

### onAuthUrl

> **onAuthUrl**: ((`url`) => `void`) \| `null` = `null`

Defined in: external-auth-store.ts:70

Hook for intercepting the auth URL instead of opening a browser.
When set, called with the auth URL. When null, uses platform-default browser open.
Useful for testing and headless environments.
