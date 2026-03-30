[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / JiraTriggerPayloadByEvent

# Type Alias: JiraTriggerPayloadByEvent

> **JiraTriggerPayloadByEvent** = `{ [K in JiraIssueSharedEvents]: JiraIssueCreatedEvent<K> }` & `object` & `object` & `object` & `object` & `{ [K in JiraIssueLinkSharedEvents]: JiraIssueLinkEvent<K> }` & `{ [K in JiraWorklogSharedEvents]: JiraWorklogEvent<K> }` & `{ [K in JiraIssueTypeSharedEvents]: JiraIssueTypeEvent<K> }` & `{ [K in JiraCustomFieldSharedEvents]: JiraCustomFieldEvent<K> }` & `{ [K in JiraCustomFieldContextSharedEvents]: JiraCustomFieldContextEvent<K> }` & `object` & `object` & `{ [K in JiraVersionSharedEvents]: JiraVersionEvent<K> }` & `object` & `object` & `{ [K in JiraProjectSharedEvents]: JiraProjectEvent<K> }` & `{ [K in JiraAttachmentSharedEvents]: JiraAttachmentEvent<K> }` & `{ [K in JiraComponentSharedEvents]: JiraComponentEvent<K> }` & `{ [K in JiraUserCreatedUpdatedSharedEvents]: JiraUserCreatedUpdatedEvent<K> }` & `object` & `{ [K in JiraFilterSharedEvents]: JiraFilterEvent<K> }` & `object` & `object`

Defined in: trigger-event-types.ts:883

## Type Declaration

### avi:jira:updated:issue

> **avi:jira:updated:issue**: `JiraIssueUpdatedEvent`

## Type Declaration

### avi:jira:commented:issue

> **avi:jira:commented:issue**: `JiraCommentedIssueEvent`

## Type Declaration

### avi:jira:mentioned:comment

> **avi:jira:mentioned:comment**: `JiraMentionedInCommentEvent`

## Type Declaration

### avi:jira:deleted:comment

> **avi:jira:deleted:comment**: `JiraDeletedCommentEvent`

## Type Declaration

### avi:jira:updated:field:context:configuration

> **avi:jira:updated:field:context:configuration**: `JiraCustomFieldContextConfigEvent`

## Type Declaration

### avi:jira:failed:expression

> **avi:jira:failed:expression**: `JiraExpressionFailedEvent`

## Type Declaration

### avi:jira:merged:version

> **avi:jira:merged:version**: `JiraVersionMergedEvent`

## Type Declaration

### avi:jira:deleted:version

> **avi:jira:deleted:version**: `JiraVersionDeletedEvent`

## Type Declaration

### avi:jira:deleted:user

> **avi:jira:deleted:user**: `JiraUserDeletedEvent`

## Type Declaration

### avi:jira:timetracking:provider:changed

> **avi:jira:timetracking:provider:changed**: `JiraTimeTrackingProviderChangedEvent`

## Type Declaration

### avi:jira:changed:configuration

> **avi:jira:changed:configuration**: `JiraConfigurationChangedEvent`
