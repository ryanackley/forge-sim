[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / JiraUserDetails

# Interface: JiraUserDetails

Defined in: trigger-event-types.ts:392

Richer user object returned for user created/updated events (includes groups, roles).

## Extends

- [`JiraUser`](JiraUser.md)

## Properties

### accountId

> **accountId**: `string`

Defined in: trigger-event-types.ts:382

#### Inherited from

[`JiraUser`](JiraUser.md).[`accountId`](JiraUser.md#accountid)

***

### accountType?

> `optional` **accountType?**: `string`

Defined in: trigger-event-types.ts:383

#### Inherited from

[`JiraUser`](JiraUser.md).[`accountType`](JiraUser.md#accounttype)

***

### active?

> `optional` **active?**: `boolean`

Defined in: trigger-event-types.ts:387

#### Inherited from

[`JiraUser`](JiraUser.md).[`active`](JiraUser.md#active)

***

### applicationRoles?

> `optional` **applicationRoles?**: `object`

Defined in: trigger-event-types.ts:395

#### items

> **items**: `object`[]

#### size

> **size**: `number`

***

### avatarUrls?

> `optional` **avatarUrls?**: `JiraAvatarUrls`

Defined in: trigger-event-types.ts:386

#### Inherited from

[`JiraUser`](JiraUser.md).[`avatarUrls`](JiraUser.md#avatarurls)

***

### displayName?

> `optional` **displayName?**: `string`

Defined in: trigger-event-types.ts:384

#### Inherited from

[`JiraUser`](JiraUser.md).[`displayName`](JiraUser.md#displayname)

***

### emailAddress?

> `optional` **emailAddress?**: `string`

Defined in: trigger-event-types.ts:385

#### Inherited from

[`JiraUser`](JiraUser.md).[`emailAddress`](JiraUser.md#emailaddress)

***

### groups?

> `optional` **groups?**: `object`

Defined in: trigger-event-types.ts:394

#### items

> **items**: `object`[]

#### size

> **size**: `number`

***

### locale?

> `optional` **locale?**: `string`

Defined in: trigger-event-types.ts:393

***

### timeZone?

> `optional` **timeZone?**: `string`

Defined in: trigger-event-types.ts:388

#### Inherited from

[`JiraUser`](JiraUser.md).[`timeZone`](JiraUser.md#timezone)
