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

// ─────────────────────────────────────────────────────────────────────────────
// Jira event types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Common base for all Jira event payloads.
 * Note: unlike Confluence, Jira uses `timestamp` (epoch ms as string) rather
 * than `eventCreatedDate`, and `webhookTrace` is an optional correlation field.
 * `atlassianId` is NOT always present; individual event types declare it where documented.
 */
export interface JiraTriggerBase<TEvent extends string> {
  eventType: TEvent;
  timestamp: string; // epoch milliseconds
  webhookTrace?: string;
}

export interface JiraAvatarUrls {
  '16x16'?: string;
  '24x24'?: string;
  '32x32'?: string;
  '48x48'?: string;
}

export interface JiraUser {
  accountId: string;
  accountType?: string;
  displayName?: string;
  emailAddress?: string;
  avatarUrls?: JiraAvatarUrls;
  active?: boolean;
  timeZone?: string;
}

/** Richer user object returned for user created/updated events (includes groups, roles). */
export interface JiraUserDetails extends JiraUser {
  locale?: string;
  groups?: { size: number; items: Array<{ name: string; self?: string }> };
  applicationRoles?: { size: number; items: Array<{ key: string; name: string }> };
}

export interface JiraIssueStatus {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  statusCategory?: {
    id: number;
    key: string;
    name: string;
    colorName?: string;
  };
}

export interface JiraIssuePriority {
  id: string;
  name: string;
  iconUrl?: string;
}

/** Issue type as embedded within an issue's fields. */
export interface JiraIssueTypeRef {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  subtask?: boolean;
  hierarchyLevel?: number;
}

/** Full issue type definition as used in issue type lifecycle events. */
export interface JiraIssueTypeDefinition extends JiraIssueTypeRef {
  scope?: { type: string; project?: { id: string } };
}

export interface JiraProjectCategory {
  id: string;
  name: string;
  description?: string;
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey?: string;
  description?: string;
  simplified?: boolean;
  lead?: JiraUser;
  avatarUrls?: JiraAvatarUrls;
  projectCategory?: JiraProjectCategory;
  isPrivate?: boolean;
  self?: string;
}

export interface JiraIssueFields {
  summary?: string;
  status?: JiraIssueStatus;
  assignee?: JiraUser | null;
  reporter?: JiraUser | null;
  priority?: JiraIssuePriority;
  issuetype?: JiraIssueTypeRef;
  project?: JiraProject;
  created?: string;
  updated?: string;
  description?: unknown; // Atlassian Document Format or plain string
  labels?: string[];
  comment?: { comments: JiraComment[]; total: number; maxResults?: number };
  [key: string]: unknown;
}

export interface JiraIssue {
  id: string;
  key: string;
  self?: string;
  fields: JiraIssueFields;
}

export interface JiraChangelogItem {
  field: string;
  fieldtype?: string;
  fieldId?: string;
  from?: string | null;
  fromString?: string | null;
  to?: string | null;
  toString?: string | null;
}

export interface JiraChangelog {
  id?: string;
  items: JiraChangelogItem[];
}

export interface JiraAssociatedUsers {
  users: JiraUser[];
}

export interface JiraAssociatedStatuses {
  statuses: JiraIssueStatus[];
}

export interface JiraClonedFrom {
  id: string;
  key: string;
}

export interface JiraIssueLinkType {
  id: string;
  name: string;
  inward?: string;
  outward?: string;
  self?: string;
}

export interface JiraWorklog {
  id: string;
  issueId: string;
  author?: JiraUser;
  updateAuthor?: JiraUser;
  comment?: unknown;
  timeSpent?: string;
  timeSpentSeconds?: number;
  started?: string;
  created?: string;
  updated?: string;
  self?: string;
}

export interface JiraCommentVisibility {
  type: 'role' | 'group';
  value: string;
}

export interface JiraComment {
  id: string;
  author?: JiraUser;
  updateAuthor?: JiraUser;
  body?: unknown; // ADF or string
  renderedBody?: string;
  created?: string;
  updated?: string;
  visibility?: JiraCommentVisibility;
  jsdPublic?: boolean;
}

export interface JiraVersion {
  id: string;
  name: string;
  description?: string;
  projectId: number;
  released?: boolean;
  archived?: boolean;
  releaseDate?: string;
  startDate?: string;
  userReleaseDate?: string;
  overdue?: boolean;
  self?: string;
}

export interface JiraCustomFieldReplacement {
  customFieldId: string;
  moveTo: JiraVersion;
}

export interface JiraAttachment {
  id: string;
  author?: JiraUser;
  filename: string;
  created?: string;
  size?: number;
  mimeType?: string;
  content?: string;
  thumbnail?: string;
  self?: string;
}

export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
  lead?: JiraUser;
  leadAccountId?: string;
  assigneeType?: string;
  assignee?: JiraUser;
  realAssigneeType?: string;
  realAssignee?: JiraUser;
  isAssigneeTypeValid?: boolean;
  project?: string;
  projectId?: number;
  self?: string;
}

export interface JiraFilter {
  id: string;
  name: string;
  description?: string;
  owner?: JiraUser;
  jql?: string;
  viewUrl?: string;
  sharePermissions?: unknown[];
  editPermissions?: unknown[];
  self?: string;
}

export interface JiraProperty {
  key: string;
  value: string | boolean;
}

export interface JiraExpressionContext {
  issue?: { id: string; key?: string };
  project?: { id: string; key?: string };
  [key: string]: unknown;
}

// ── Jira event payload types ──────────────────────────────────────────────────

export type JiraIssueCreatedEvent<TEvent extends string = 'avi:jira:created:issue'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId?: string;
    associatedUsers?: JiraAssociatedUsers;
    clonedFrom?: JiraClonedFrom;
    jiraEventTypeName?: string;
  };

export type JiraIssueUpdatedEvent<TEvent extends string = 'avi:jira:updated:issue'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId?: string;
    changelog: JiraChangelog;
    jiraEventTypeName?: string;
    associatedUsers?: JiraAssociatedUsers;
    associatedStatuses?: JiraAssociatedStatuses;
  };

export type JiraIssueDeletedEvent<TEvent extends string = 'avi:jira:deleted:issue'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId?: string;
    associatedUsers?: JiraAssociatedUsers;
  };

export type JiraIssueAssignedEvent<TEvent extends string = 'avi:jira:assigned:issue'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId?: string;
    changelog: JiraChangelog;
    associatedUsers?: JiraAssociatedUsers;
  };

export type JiraIssueViewedEvent<TEvent extends string = 'avi:jira:viewed:issue'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId: string;
    user: JiraUser;
  };

export type JiraIssueMentionedEvent<TEvent extends string = 'avi:jira:mentioned:issue'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId?: string;
    mentionedAccountIds: string[];
  };

export type JiraIssueLinkEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    id: string;
    sourceIssueId: string;
    destinationIssueId: string;
    sourceProjectId: string;
    destinationProjectId: string;
    issueLinkType: JiraIssueLinkType;
  };

export type JiraWorklogEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    worklog: JiraWorklog;
  };

export type JiraIssueTypeEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    issueType: JiraIssueTypeDefinition;
    atlassianId?: string;
  };

export type JiraCommentedIssueEvent<TEvent extends string = 'avi:jira:commented:issue'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId?: string;
    associatedUsers?: JiraAssociatedUsers;
    comment: JiraComment;
  };

export type JiraMentionedInCommentEvent<TEvent extends string = 'avi:jira:mentioned:comment'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId?: string;
    mentionedAccountIds: string[];
    comment: JiraComment;
  };

export type JiraDeletedCommentEvent<TEvent extends string = 'avi:jira:deleted:comment'> =
  JiraTriggerBase<TEvent> & {
    issue: JiraIssue;
    atlassianId?: string;
    comment: JiraComment;
  };

export type JiraCustomFieldEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    id: string;
    key: string;
    type: string;
    typeName: string;
    name: string;
    description: string;
  };

export type JiraCustomFieldContextEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    id: string;
    fieldId: string;
    fieldKey: string;
    name: string;
    description: string;
    projectIds: number[];
    issueTypeIds: string[];
  };

export type JiraCustomFieldContextConfigEvent<TEvent extends string = 'avi:jira:updated:field:context:configuration'> =
  JiraTriggerBase<TEvent> & {
    customFieldId: string;
    customFieldKey: string;
    configurationId: number;
    fieldContextId: number;
    configuration: string; // stringified JSON
  };

export type JiraExpressionFailedEvent<TEvent extends string = 'avi:jira:failed:expression'> =
  JiraTriggerBase<TEvent> & {
    extensionId: string;
    workflowId: string;
    workflowName: string;
    conditionId?: string;
    validatorId?: string;
    expression: string;
    errorMessages: string[];
    context: JiraExpressionContext;
  };

export type JiraVersionEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    version: JiraVersion;
    atlassianId?: string;
  };

export type JiraVersionMergedEvent<TEvent extends string = 'avi:jira:merged:version'> =
  JiraVersionEvent<TEvent> & {
    mergedVersion?: JiraVersion;
  };

export type JiraVersionDeletedEvent<TEvent extends string = 'avi:jira:deleted:version'> =
  JiraVersionEvent<TEvent> & {
    mergedVersion?: JiraVersion;
    newAffectsVersion?: JiraVersion;
    newFixVersion?: JiraVersion;
    customFieldReplacements: JiraCustomFieldReplacement[];
  };

export type JiraProjectEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    project: JiraProject;
  };

export type JiraAttachmentEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    attachment: JiraAttachment;
  };

export type JiraComponentEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    component: JiraComponent;
    atlassianId?: string;
  };

export type JiraUserCreatedUpdatedEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    user: JiraUserDetails;
  };

export type JiraUserDeletedEvent<TEvent extends string = 'avi:jira:deleted:user'> =
  JiraTriggerBase<TEvent> & {
    user: JiraUser;
  };

export type JiraFilterEvent<TEvent extends string> =
  JiraTriggerBase<TEvent> & {
    filter: JiraFilter;
    atlassianId?: string;
  };

export type JiraTimeTrackingProviderChangedEvent<TEvent extends string = 'avi:jira:timetracking:provider:changed'> =
  JiraTriggerBase<TEvent> & {
    property: JiraProperty;
  };

export type JiraConfigurationChangedEvent<TEvent extends string = 'avi:jira:changed:configuration'> =
  JiraTriggerBase<TEvent> & {
    property: JiraProperty;
    atlassianId?: string;
  };

// ── Event name union types ────────────────────────────────────────────────────

export type JiraIssueSharedEvents =
  | 'avi:jira:created:issue'
  | 'avi:jira:deleted:issue'
  | 'avi:jira:assigned:issue'
  | 'avi:jira:viewed:issue'
  | 'avi:jira:mentioned:issue';

export type JiraIssueLinkSharedEvents =
  | 'avi:jira:created:issuelink'
  | 'avi:jira:deleted:issuelink';

export type JiraWorklogSharedEvents =
  | 'avi:jira:created:worklog'
  | 'avi:jira:updated:worklog'
  | 'avi:jira:deleted:worklog';

export type JiraIssueTypeSharedEvents =
  | 'avi:jira:created:issuetype'
  | 'avi:jira:updated:issuetype'
  | 'avi:jira:deleted:issuetype';

export type JiraCustomFieldSharedEvents =
  | 'avi:jira:created:field'
  | 'avi:jira:updated:field'
  | 'avi:jira:trashed:field'
  | 'avi:jira:restored:field'
  | 'avi:jira:deleted:field';

export type JiraCustomFieldContextSharedEvents =
  | 'avi:jira:created:field:context'
  | 'avi:jira:updated:field:context'
  | 'avi:jira:deleted:field:context';

export type JiraVersionSharedEvents =
  | 'avi:jira:created:version'
  | 'avi:jira:updated:version'
  | 'avi:jira:released:version'
  | 'avi:jira:unreleased:version'
  | 'avi:jira:archived:version'
  | 'avi:jira:unarchived:version'
  | 'avi:jira:moved:version';

export type JiraProjectSharedEvents =
  | 'avi:jira:created:project'
  | 'avi:jira:updated:project'
  | 'avi:jira:softdeleted:project'
  | 'avi:jira:deleted:project'
  | 'avi:jira:archived:project'
  | 'avi:jira:unarchived:project'
  | 'avi:jira:restored:project';

export type JiraAttachmentSharedEvents =
  | 'avi:jira:created:attachment'
  | 'avi:jira:deleted:attachment';

export type JiraComponentSharedEvents =
  | 'avi:jira:created:component'
  | 'avi:jira:updated:component'
  | 'avi:jira:deleted:component';

export type JiraUserCreatedUpdatedSharedEvents =
  | 'avi:jira:created:user'
  | 'avi:jira:updated:user';

export type JiraFilterSharedEvents =
  | 'avi:jira:created:filter'
  | 'avi:jira:updated:filter'
  | 'avi:jira:deleted:filter';

// ── Payload map ───────────────────────────────────────────────────────────────

export type JiraTriggerPayloadByEvent =
  & { [K in JiraIssueSharedEvents]: JiraIssueCreatedEvent<K> }
  & { 'avi:jira:updated:issue': JiraIssueUpdatedEvent }
  & { 'avi:jira:commented:issue': JiraCommentedIssueEvent }
  & { 'avi:jira:mentioned:comment': JiraMentionedInCommentEvent }
  & { 'avi:jira:deleted:comment': JiraDeletedCommentEvent }
  & { [K in JiraIssueLinkSharedEvents]: JiraIssueLinkEvent<K> }
  & { [K in JiraWorklogSharedEvents]: JiraWorklogEvent<K> }
  & { [K in JiraIssueTypeSharedEvents]: JiraIssueTypeEvent<K> }
  & { [K in JiraCustomFieldSharedEvents]: JiraCustomFieldEvent<K> }
  & { [K in JiraCustomFieldContextSharedEvents]: JiraCustomFieldContextEvent<K> }
  & { 'avi:jira:updated:field:context:configuration': JiraCustomFieldContextConfigEvent }
  & { 'avi:jira:failed:expression': JiraExpressionFailedEvent }
  & { [K in JiraVersionSharedEvents]: JiraVersionEvent<K> }
  & { 'avi:jira:merged:version': JiraVersionMergedEvent }
  & { 'avi:jira:deleted:version': JiraVersionDeletedEvent }
  & { [K in JiraProjectSharedEvents]: JiraProjectEvent<K> }
  & { [K in JiraAttachmentSharedEvents]: JiraAttachmentEvent<K> }
  & { [K in JiraComponentSharedEvents]: JiraComponentEvent<K> }
  & { [K in JiraUserCreatedUpdatedSharedEvents]: JiraUserCreatedUpdatedEvent<K> }
  & { 'avi:jira:deleted:user': JiraUserDeletedEvent }
  & { [K in JiraFilterSharedEvents]: JiraFilterEvent<K> }
  & { 'avi:jira:timetracking:provider:changed': JiraTimeTrackingProviderChangedEvent }
  & { 'avi:jira:changed:configuration': JiraConfigurationChangedEvent };

// Re-export as the combined union
export type TriggerPayloadByEvent = ConfluenceTriggerPayloadByEvent & JiraTriggerPayloadByEvent;
export type KnownTriggerEvent = keyof TriggerPayloadByEvent;
