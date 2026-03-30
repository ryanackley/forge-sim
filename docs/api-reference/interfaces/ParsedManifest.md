[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / ParsedManifest

# Interface: ParsedManifest

Defined in: manifest.ts:17

## Properties

### actions

> **actions**: `ManifestAction`[]

Defined in: manifest.ts:35

Rovo action definitions (for tools UI invocation)

***

### authProviders

> **authProviders**: `Map`\<`string`, `ManifestAuthProvider`\>

Defined in: manifest.ts:29

***

### commandPageTargets

> **commandPageTargets**: `object`[]

Defined in: manifest.ts:33

Command palette entries that reference existing module pages (not rendered separately)

#### key

> **key**: `string`

#### shortcut?

> `optional` **shortcut?**: `string`

#### targetPage

> **targetPage**: `string`

#### title

> **title**: `string`

***

### consumers

> **consumers**: [`ManifestConsumer`](ManifestConsumer.md)[]

Defined in: manifest.ts:21

***

### endpoints

> **endpoints**: `Map`\<`string`, `ManifestEndpoint`\>

Defined in: manifest.ts:28

***

### functions

> **functions**: `Map`\<`string`, [`ManifestFunction`](ManifestFunction.md)\>

Defined in: manifest.ts:19

***

### permissions

> **permissions**: `string`[]

Defined in: manifest.ts:26

***

### raw

> **raw**: [`ForgeManifest`](ForgeManifest.md)

Defined in: manifest.ts:18

***

### remotes

> **remotes**: `Map`\<`string`, `ManifestRemote`\>

Defined in: manifest.ts:27

***

### resources

> **resources**: `Map`\<`string`, `ManifestResource`\>

Defined in: manifest.ts:20

***

### scheduledTriggers

> **scheduledTriggers**: [`ManifestScheduledTrigger`](ManifestScheduledTrigger.md)[]

Defined in: manifest.ts:23

***

### triggers

> **triggers**: [`ManifestTrigger`](ManifestTrigger.md)[]

Defined in: manifest.ts:22

***

### uiModules

> **uiModules**: [`ManifestUIModule`](ManifestUIModule.md)[]

Defined in: manifest.ts:24

***

### warnings

> **warnings**: `ManifestWarning`[]

Defined in: manifest.ts:31

Validation warnings/errors found during parsing

***

### webTriggers

> **webTriggers**: `ManifestWebTrigger`[]

Defined in: manifest.ts:25
