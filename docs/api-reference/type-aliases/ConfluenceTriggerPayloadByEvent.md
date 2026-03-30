[**forge-sim**](../README.md)

***

[forge-sim](../README.md) / ConfluenceTriggerPayloadByEvent

# Type Alias: ConfluenceTriggerPayloadByEvent

> **ConfluenceTriggerPayloadByEvent** = `{ [K in ConfluencePageSharedEvents]: ConfluenceContentEvent<K, "page"> }` & `object` & `object` & `object` & `object` & `object` & `object` & `{ [K in ConfluenceBlogpostSharedEvents]: ConfluenceContentEvent<K, "blogpost"> }` & `object` & `{ [K in ConfluenceWhiteboardSharedEvents]: ConfluenceContentEvent<K, "whiteboard"> }` & `{ [K in ConfluenceDatabaseSharedEvents]: ConfluenceContentEvent<K, "database"> }` & `{ [K in ConfluenceEmbedSharedEvents]: ConfluenceContentEvent<K, "embed"> }` & `{ [K in ConfluenceFolderSharedEvents]: ConfluenceContentEvent<K, "folder"> }` & `{ [K in ConfluenceTaskSharedEvents]: ConfluenceTaskEvent<K> }` & `object` & `{ [K in ConfluenceCommentSharedEvents]: ConfluenceCommentEvent<K> }` & `object` & `{ [K in ConfluenceSpaceSharedEvents]: ConfluenceSpaceEvent<K> }` & `{ [K in ConfluenceAttachmentSharedEvents]: ConfluenceAttachmentEvent<K> }` & `object` & `{ [K in ConfluenceCustomContentSharedEvents]: ConfluenceCustomContentEvent<K> }` & `object` & `{ [K in ConfluenceLabelSharedEvents]: ConfluenceLabelEvent<K> }` & `{ [K in ConfluenceUserSharedEvents]: ConfluenceUserEvent<K> }` & `{ [K in ConfluenceGroupSharedEvents]: ConfluenceGroupEvent<K> }` & `{ [K in ConfluenceRelationSharedEvents]: ConfluenceRelationEvent<K> }` & `{ [K in ConfluenceSearchSharedEvents]: ConfluenceSearchEvent<K> }`

Defined in: trigger-event-types.ts:329

## Type Declaration

### avi:confluence:updated:page

> **avi:confluence:updated:page**: `ConfluenceUpdatedContentEvent`\<`"avi:confluence:updated:page"`, `"page"`\>

## Type Declaration

### avi:confluence:moved:page

> **avi:confluence:moved:page**: `ConfluenceMovedContentEvent`\<`"avi:confluence:moved:page"`, `"page"`\>

## Type Declaration

### avi:confluence:copied:page

> **avi:confluence:copied:page**: `ConfluenceCopiedContentEvent`\<`"avi:confluence:copied:page"`, `"page"`\>

## Type Declaration

### avi:confluence:children\_reordered:page

> **avi:confluence:children\_reordered:page**: `ConfluenceChildrenReorderedPageEvent`\<`"avi:confluence:children_reordered:page"`\>

## Type Declaration

### avi:confluence:started:page

> **avi:confluence:started:page**: `ConfluenceUpdatedContentEvent`\<`"avi:confluence:started:page"`, `"page"`\>

## Type Declaration

### avi:confluence:snapshotted:page

> **avi:confluence:snapshotted:page**: `ConfluenceUpdatedContentEvent`\<`"avi:confluence:snapshotted:page"`, `"page"`\>

## Type Declaration

### avi:confluence:updated:blogpost

> **avi:confluence:updated:blogpost**: `ConfluenceUpdatedContentEvent`\<`"avi:confluence:updated:blogpost"`, `"blogpost"`\>

## Type Declaration

### avi:confluence:updated:task

> **avi:confluence:updated:task**: `ConfluenceUpdatedTaskEvent`\<`"avi:confluence:updated:task"`\>

## Type Declaration

### avi:confluence:updated:comment

> **avi:confluence:updated:comment**: `ConfluenceUpdatedCommentEvent`\<`"avi:confluence:updated:comment"`\>

## Type Declaration

### avi:confluence:updated:attachment

> **avi:confluence:updated:attachment**: `ConfluenceUpdatedAttachmentEvent`\<`"avi:confluence:updated:attachment"`\>

## Type Declaration

### avi:confluence:updated:custom\_content

> **avi:confluence:updated:custom\_content**: `ConfluenceUpdatedCustomContentEvent`\<`"avi:confluence:updated:custom_content"`\>
