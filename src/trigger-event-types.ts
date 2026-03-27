/**
 * Strong TypeScript payload types for programmatic trigger invocation.
 *
 * These types are canonical for forge-sim's public programmatic API.
 * UI/MCP samples can be looser, but `sim.fireTrigger()` should provide
 * event-name autocomplete and payload-type checking for documented events.
 *
 * First cut: Confluence product events only.
 */

export interface ConfluenceTriggerBase<TEvent extends string> {
  eventType: TEvent;
  eventCreatedDate: string;
  atlassianId?: string;
  suppressNotifications?: boolean;
}

export interface ConfluenceImage {
  path: string;
  width: number;
  height: number;
  isDefault: boolean;
}

export interface ConfluenceUser {
  type?: 'known' | 'anonymous' | string;
  username?: string;
  accountId: string;
  accountType?: string;
  email?: string;
  profilePicture?: ConfluenceImage;
  displayName?: string;
  publicName?: string;
  isExternalCollaborator?: boolean;
}

export interface ConfluenceHistory {
  latest?: boolean;
  createdBy?: ConfluenceUser;
  ownedBy?: ConfluenceUser;
  createdDate?: string;
}

export interface ConfluenceVersion {
  by?: ConfluenceUser;
  when?: string;
  number: number;
}

export interface ConfluenceSpace {
  id: string | number;
  key: string;
  alias?: string;
  name: string;
  icon?: ConfluenceImage;
  type?: string;
  status?: string;
  history?: {
    createdBy?: ConfluenceUser;
    createdDate?: string;
  };
  homepage?: {
    id: string | number;
    type: string;
    title: string;
    status?: string;
  };
  labels?: ConfluenceLabel[];
}

export interface ConfluenceLabel {
  id: string;
  name: string;
  prefix: string;
}

export interface ConfluenceTemplate {
  templateId: string;
  name: string;
  description?: string;
  templateType?: string;
  space?: ConfluenceSpace;
  labels?: ConfluenceLabel[];
}

export interface ConfluenceContentReference<TType extends string = string> {
  id: string | number;
  type: TType;
  status?: string;
  title?: string;
  history?: ConfluenceHistory;
  version?: ConfluenceVersion;
  space?: ConfluenceSpace;
  subType?: string;
}

export interface ConfluenceContent<TType extends string = string> extends ConfluenceContentReference<TType> {
  ancestors?: Array<ConfluenceContentReference>;
  container?: ConfluenceContentReference;
  extensions?: Record<string, unknown>;
  labels?: ConfluenceLabel[];
}

export interface ConfluenceTask {
  id: number;
  uuid: string;
  status: string;
  statusAsString?: string;
  assignee?: string;
  dueDate?: string;
}

export interface ConfluenceGroup {
  id: string;
  name: string;
}

export interface ConfluenceRelationEntityWrapper {
  user?: ConfluenceUser;
  content?: ConfluenceContent;
  space?: ConfluenceSpace;
}

export type ConfluencePageLikeType = 'page' | 'blogpost' | 'whiteboard' | 'database' | 'embed' | 'folder';

export type ConfluenceContentEvent<TEvent extends string, TType extends string> =
  ConfluenceTriggerBase<TEvent> & {
    content: ConfluenceContent<TType>;
  };

export type ConfluenceUpdatedContentEvent<TEvent extends string, TType extends string> =
  ConfluenceContentEvent<TEvent, TType> & {
    updateTrigger: string;
  };

export type ConfluenceMovedContentEvent<TEvent extends string, TType extends string> =
  ConfluenceContentEvent<TEvent, TType> & {
    prevContent: ConfluenceContent<TType>;
  };

export type ConfluenceCopiedContentEvent<TEvent extends string, TType extends string> =
  ConfluenceContentEvent<TEvent, TType> & {
    originContentId: string | number;
  };

export type ConfluenceChildrenReorderedPageEvent<TEvent extends string> =
  ConfluenceContentEvent<TEvent, 'page'> & {
    oldSortedChildPageIds: Array<string | number>;
    newSortedChildPageIds: Array<string | number>;
  };

export type ConfluenceTaskEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    task: ConfluenceTask;
    content: ConfluenceContent<'page'>;
  };

export type ConfluenceUpdatedTaskEvent<TEvent extends string> =
  ConfluenceTaskEvent<TEvent> & {
    oldTask: ConfluenceTask;
  };

export type ConfluenceCommentEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    content: ConfluenceContent<'comment'>;
  };

export type ConfluenceUpdatedCommentEvent<TEvent extends string> =
  ConfluenceCommentEvent<TEvent> & {
    updateTrigger: string;
  };

export type ConfluenceSpaceEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    space: ConfluenceSpace;
  };

export type ConfluenceAttachmentEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    attachment: ConfluenceContent<'attachment'>;
  };

export type ConfluenceUpdatedAttachmentEvent<TEvent extends string> =
  ConfluenceAttachmentEvent<TEvent> & {
    updateTrigger: string;
  };

export type ConfluenceCustomContentEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    content: ConfluenceContent<string>;
  };

export type ConfluenceUpdatedCustomContentEvent<TEvent extends string> =
  ConfluenceCustomContentEvent<TEvent> & {
    updateTrigger: string;
  };

export type ConfluenceLabelEventSubject =
  | { content: ConfluenceContent }
  | { space: ConfluenceSpace }
  | { template: ConfluenceTemplate };

export type ConfluenceLabelEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    label: ConfluenceLabel;
  } & ConfluenceLabelEventSubject;

export type ConfluenceUserEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    user: ConfluenceUser;
  };

export type ConfluenceGroupEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    group: ConfluenceGroup;
  };

export type ConfluenceRelationEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    relationName: string;
    relationData?: Record<string, unknown>;
    source: ConfluenceRelationEntityWrapper;
    target: ConfluenceRelationEntityWrapper;
  };

export type ConfluenceSearchEvent<TEvent extends string> =
  ConfluenceTriggerBase<TEvent> & {
    query: string;
    accountType?: string;
    results?: number;
  };

export type ConfluencePageSharedEvents =
  | 'avi:confluence:liked:page'
  | 'avi:confluence:viewed:page'
  | 'avi:confluence:archived:page'
  | 'avi:confluence:unarchived:page'
  | 'avi:confluence:permissions_updated:page'
  | 'avi:confluence:trashed:page'
  | 'avi:confluence:restored:page'
  | 'avi:confluence:deleted:page'
  | 'avi:confluence:created:page'
  | 'avi:confluence:initialized:page'
  | 'avi:confluence:published:page';

export type ConfluenceBlogpostSharedEvents =
  | 'avi:confluence:created:blogpost'
  | 'avi:confluence:liked:blogpost'
  | 'avi:confluence:viewed:blogpost'
  | 'avi:confluence:permissions_updated:blogpost'
  | 'avi:confluence:trashed:blogpost'
  | 'avi:confluence:restored:blogpost'
  | 'avi:confluence:deleted:blogpost';

export type ConfluenceWhiteboardSharedEvents =
  | 'avi:confluence:created:whiteboard'
  | 'avi:confluence:moved:whiteboard'
  | 'avi:confluence:copied:whiteboard'
  | 'avi:confluence:permissions_updated:whiteboard';

export type ConfluenceDatabaseSharedEvents =
  | 'avi:confluence:created:database'
  | 'avi:confluence:moved:database'
  | 'avi:confluence:copied:database'
  | 'avi:confluence:permissions_updated:database';

export type ConfluenceEmbedSharedEvents =
  | 'avi:confluence:created:embed'
  | 'avi:confluence:moved:embed'
  | 'avi:confluence:copied:embed';

export type ConfluenceFolderSharedEvents =
  | 'avi:confluence:created:folder'
  | 'avi:confluence:moved:folder'
  | 'avi:confluence:copied:folder'
  | 'avi:confluence:permissions_updated:folder';

export type ConfluenceTaskSharedEvents =
  | 'avi:confluence:created:task'
  | 'avi:confluence:removed:task';

export type ConfluenceCommentSharedEvents =
  | 'avi:confluence:created:comment'
  | 'avi:confluence:liked:comment'
  | 'avi:confluence:deleted:comment';

export type ConfluenceSpaceSharedEvents =
  | 'avi:confluence:created:space:V2'
  | 'avi:confluence:updated:space:V2'
  | 'avi:confluence:permissions_updated:space:V2'
  | 'avi:confluence:deleted:space:V2';

export type ConfluenceAttachmentSharedEvents =
  | 'avi:confluence:created:attachment'
  | 'avi:confluence:viewed:attachment'
  | 'avi:confluence:archived:attachment'
  | 'avi:confluence:unarchived:attachment'
  | 'avi:confluence:trashed:attachment'
  | 'avi:confluence:restored:attachment'
  | 'avi:confluence:deleted:attachment';

export type ConfluenceCustomContentSharedEvents =
  | 'avi:confluence:created:custom_content'
  | 'avi:confluence:permissions_updated:custom_content'
  | 'avi:confluence:trashed:custom_content'
  | 'avi:confluence:restored:custom_content'
  | 'avi:confluence:deleted:custom_content';

export type ConfluenceLabelSharedEvents =
  | 'avi:confluence:created:label'
  | 'avi:confluence:added:label'
  | 'avi:confluence:removed:label'
  | 'avi:confluence:deleted:label';

export type ConfluenceUserSharedEvents =
  | 'avi:confluence:created:user'
  | 'avi:confluence:deleted:user';

export type ConfluenceGroupSharedEvents =
  | 'avi:confluence:created:group'
  | 'avi:confluence:deleted:group';

export type ConfluenceRelationSharedEvents =
  | 'avi:confluence:created:relation'
  | 'avi:confluence:deleted:relation';

export type ConfluenceSearchSharedEvents = 'avi:confluence:performed:search';

export type ConfluenceTriggerPayloadByEvent =
  & { [K in ConfluencePageSharedEvents]: ConfluenceContentEvent<K, 'page'> }
  & { 'avi:confluence:updated:page': ConfluenceUpdatedContentEvent<'avi:confluence:updated:page', 'page'> }
  & { 'avi:confluence:moved:page': ConfluenceMovedContentEvent<'avi:confluence:moved:page', 'page'> }
  & { 'avi:confluence:copied:page': ConfluenceCopiedContentEvent<'avi:confluence:copied:page', 'page'> }
  & { 'avi:confluence:children_reordered:page': ConfluenceChildrenReorderedPageEvent<'avi:confluence:children_reordered:page'> }
  & { 'avi:confluence:started:page': ConfluenceUpdatedContentEvent<'avi:confluence:started:page', 'page'> }
  & { 'avi:confluence:snapshotted:page': ConfluenceUpdatedContentEvent<'avi:confluence:snapshotted:page', 'page'> }
  & { [K in ConfluenceBlogpostSharedEvents]: ConfluenceContentEvent<K, 'blogpost'> }
  & { 'avi:confluence:updated:blogpost': ConfluenceUpdatedContentEvent<'avi:confluence:updated:blogpost', 'blogpost'> }
  & { [K in ConfluenceWhiteboardSharedEvents]: ConfluenceContentEvent<K, 'whiteboard'> }
  & { [K in ConfluenceDatabaseSharedEvents]: ConfluenceContentEvent<K, 'database'> }
  & { [K in ConfluenceEmbedSharedEvents]: ConfluenceContentEvent<K, 'embed'> }
  & { [K in ConfluenceFolderSharedEvents]: ConfluenceContentEvent<K, 'folder'> }
  & { [K in ConfluenceTaskSharedEvents]: ConfluenceTaskEvent<K> }
  & { 'avi:confluence:updated:task': ConfluenceUpdatedTaskEvent<'avi:confluence:updated:task'> }
  & { [K in ConfluenceCommentSharedEvents]: ConfluenceCommentEvent<K> }
  & { 'avi:confluence:updated:comment': ConfluenceUpdatedCommentEvent<'avi:confluence:updated:comment'> }
  & { [K in ConfluenceSpaceSharedEvents]: ConfluenceSpaceEvent<K> }
  & { [K in ConfluenceAttachmentSharedEvents]: ConfluenceAttachmentEvent<K> }
  & { 'avi:confluence:updated:attachment': ConfluenceUpdatedAttachmentEvent<'avi:confluence:updated:attachment'> }
  & { [K in ConfluenceCustomContentSharedEvents]: ConfluenceCustomContentEvent<K> }
  & { 'avi:confluence:updated:custom_content': ConfluenceUpdatedCustomContentEvent<'avi:confluence:updated:custom_content'> }
  & { [K in ConfluenceLabelSharedEvents]: ConfluenceLabelEvent<K> }
  & { [K in ConfluenceUserSharedEvents]: ConfluenceUserEvent<K> }
  & { [K in ConfluenceGroupSharedEvents]: ConfluenceGroupEvent<K> }
  & { [K in ConfluenceRelationSharedEvents]: ConfluenceRelationEvent<K> }
  & { [K in ConfluenceSearchSharedEvents]: ConfluenceSearchEvent<K> };

export type TriggerPayloadByEvent = ConfluenceTriggerPayloadByEvent;
export type KnownTriggerEvent = keyof TriggerPayloadByEvent;
