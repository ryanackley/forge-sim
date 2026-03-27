/**
 * Central registry of sample trigger payload templates.
 *
 * First cut: Confluence product events only.
 *
 * Templates are shaped to be merged into forge-sim's trigger invocation wrapper:
 *   { event: eventName, ...samplePayload }
 *
 * We also include Atlassian's documented `eventType` field in the sample payloads,
 * because real Forge event payloads include it even though forge-sim injects `event`
 * separately today.
 */

export interface TriggerEventTemplate {
  product: 'confluence' | 'jira' | 'app-lifecycle' | 'jira-software';
  family:
    | 'content'
    | 'task'
    | 'comment'
    | 'space'
    | 'attachment'
    | 'customContent'
    | 'label'
    | 'user'
    | 'group'
    | 'relation'
    | 'search'
    // Jira-specific families
    | 'issue'
    | 'issueLink'
    | 'worklog'
    | 'issueType'
    | 'customField'
    | 'customFieldContext'
    | 'workflow'
    | 'version'
    | 'project'
    | 'component'
    | 'filter'
    | 'configuration'
    // App lifecycle families
    | 'lifecycle'
    // Jira Software families
    | 'board'
    | 'sprint';
  event: string;
  samplePayload: Record<string, unknown>;
  notes?: string[];
}

const SAMPLE_TIMESTAMP = '2021-01-20T06:29:21.907Z';
const SAMPLE_CONTENT_TIMESTAMP = '2021-01-20T06:29:21.707Z';
const SAMPLE_ACCOUNT_ID = '4ad9aa0c52dc1b420a791d12';

const SAMPLE_IMAGE = {
  path: '/images/logo/default-space-logo-256.png',
  width: 48,
  height: 48,
  isDefault: false,
};

const SAMPLE_PROFILE_PICTURE = {
  path: `/wiki/aa-avatar/${SAMPLE_ACCOUNT_ID}`,
  width: 48,
  height: 48,
  isDefault: false,
};

const SAMPLE_USER = {
  type: 'known',
  username: SAMPLE_ACCOUNT_ID,
  accountId: SAMPLE_ACCOUNT_ID,
  accountType: 'atlassian',
  email: SAMPLE_ACCOUNT_ID,
  profilePicture: SAMPLE_PROFILE_PICTURE,
  displayName: SAMPLE_ACCOUNT_ID,
  publicName: SAMPLE_ACCOUNT_ID,
  isExternalCollaborator: false,
};

const SAMPLE_SPACE = {
  id: 827392002,
  key: 'SP',
  alias: 'SP',
  name: 'Project: Sample Project',
  icon: SAMPLE_IMAGE,
  type: 'global',
  status: 'current',
};

const SAMPLE_SPACE_WITH_HISTORY = {
  ...SAMPLE_SPACE,
  history: {
    createdBy: SAMPLE_USER,
    createdDate: '2021-01-20T06:29:20.501Z',
  },
};

const SAMPLE_HISTORY = {
  latest: true,
  createdBy: SAMPLE_USER,
  ownedBy: SAMPLE_USER,
  createdDate: SAMPLE_CONTENT_TIMESTAMP,
};

const SAMPLE_VERSION = {
  by: SAMPLE_USER,
  when: SAMPLE_CONTENT_TIMESTAMP,
  number: 1,
};

const SAMPLE_LABEL = {
  id: '123456789',
  name: 'example-label',
  prefix: 'global',
};

const SAMPLE_EXISTING_LABELS = [
  {
    id: '123456701',
    name: 'existing-label-1',
    prefix: 'global',
  },
  {
    id: '123456702',
    name: 'existing-label-2',
    prefix: 'team',
  },
];

function clone<T>(value: T): T {
  return structuredClone(value);
}

function makeBasePayload(
  eventType: string,
  extra: Record<string, unknown>,
  options?: { includeAtlassianId?: boolean; includeSuppressNotifications?: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    eventType,
    eventCreatedDate: SAMPLE_TIMESTAMP,
  };

  if (options?.includeAtlassianId !== false) {
    payload.atlassianId = SAMPLE_ACCOUNT_ID;
  }

  if (options?.includeSuppressNotifications) {
    payload.suppressNotifications = false;
  }

  return { ...payload, ...extra };
}

function makeContent(
  type: string,
  title: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: '838205441',
    type,
    status: 'current',
    title,
    space: clone(SAMPLE_SPACE),
    history: clone(SAMPLE_HISTORY),
    version: clone(SAMPLE_VERSION),
    ...overrides,
  };
}

function makePageLikePayload(
  eventType: string,
  content: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return makeBasePayload(eventType, {
    content,
    ...extra,
  }, { includeSuppressNotifications: true });
}

function makeTask(task: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    uuid: 'e0a0e71d-5575-4185-bf33-61364fb0960e',
    status: 'incomplete',
    statusAsString: 'UNCHECKED',
    assignee: SAMPLE_ACCOUNT_ID,
    dueDate: '2021-02-21T07:00:00Z',
    ...task,
  };
}

function makeCommentContent(): Record<string, unknown> {
  return {
    id: '838205455',
    type: 'comment',
    status: 'current',
    title: 'Re: A brand new page',
    space: clone(SAMPLE_SPACE),
    history: clone(SAMPLE_HISTORY),
    version: clone(SAMPLE_VERSION),
    ancestors: [
      {
        id: '838205415',
        type: 'comment',
        status: 'current',
        title: 'Re: A brand new page',
        history: clone(SAMPLE_HISTORY),
      },
    ],
    container: {
      id: 838205441,
      type: 'page',
      status: 'current',
      title: 'A brand new page',
      history: clone(SAMPLE_HISTORY),
      version: clone(SAMPLE_VERSION),
      space: clone(SAMPLE_SPACE),
    },
    extensions: {
      location: 'footer',
    },
  };
}

function makeAttachment(): Record<string, unknown> {
  return {
    id: '838205455',
    type: 'attachment',
    status: 'current',
    title: 'logo.png',
    space: clone(SAMPLE_SPACE),
    history: clone(SAMPLE_HISTORY),
    version: clone(SAMPLE_VERSION),
    container: {
      id: '838205441',
      type: 'page',
      status: 'current',
      title: 'A brand new page',
      history: clone(SAMPLE_HISTORY),
      version: clone(SAMPLE_VERSION),
      space: clone(SAMPLE_SPACE),
    },
    extensions: {
      mediaType: 'image/png',
      fileSize: 3329,
      mediaTypeDescription: 'PNG Image',
      fileId: 'b23c8f6f-5b24-401f-9f97-3e83650d858e',
      downloadPath: 'https://example.atlassian.net/wiki/download/attachments/838205441/logo.png?version=5&cacheVersion=1&api=v2',
    },
  };
}

function makeCustomContent(): Record<string, unknown> {
  return {
    id: 838205552,
    type: 'forge:9149a1f2-9ed3-44ab-80e8-741adf4187fd:2edb9983-c665-4da2-a714-48572fb09cd0:my-custom-content',
    status: 'current',
    title: 'My custom content 001',
    space: clone(SAMPLE_SPACE),
    history: clone(SAMPLE_HISTORY),
    version: clone(SAMPLE_VERSION),
    container: {
      id: 838205441,
      type: 'page',
      status: 'current',
      title: 'A brand new page',
      history: clone(SAMPLE_HISTORY),
      version: clone(SAMPLE_VERSION),
    },
  };
}

function makeLabelContent(): Record<string, unknown> {
  return {
    id: '838205441',
    type: 'page',
    subType: 'live',
    title: 'A brand new page',
    status: 'current',
    space: clone(SAMPLE_SPACE),
    history: clone(SAMPLE_HISTORY),
    version: clone(SAMPLE_VERSION),
    labels: clone(SAMPLE_EXISTING_LABELS),
  };
}

function makeLabelSpace(): Record<string, unknown> {
  return {
    ...clone(SAMPLE_SPACE_WITH_HISTORY),
    homepage: {
      id: '827392004',
      type: 'page',
      title: 'SP Home',
      status: 'current',
    },
    labels: clone(SAMPLE_EXISTING_LABELS),
  };
}

function makeLabelTemplate(): Record<string, unknown> {
  return {
    templateId: '123456789',
    name: 'Example Template',
    description: 'A template for demonstration purposes.',
    templateType: 'page',
    space: clone(SAMPLE_SPACE),
    labels: clone(SAMPLE_EXISTING_LABELS),
  };
}

const PAGE_CONTENT = makeContent('page', 'A brand new page');
const LIVE_DOC_CONTENT = makeContent('page', 'A brand new live doc', { subType: 'live' });
const BLOGPOST_CONTENT = makeContent('blogpost', 'Quarterly launch update');
const WHITEBOARD_CONTENT = makeContent('whiteboard', 'Quarterly planning whiteboard');
const DATABASE_CONTENT = makeContent('database', 'Launch tracker database');
const EMBED_CONTENT = makeContent('embed', 'Launch checklist smart link');
const FOLDER_CONTENT = makeContent('folder', 'Product ops folder');

const PAGE_OR_LIVE_NOTES = [
  'This event name is shared by pages and live docs. Live-doc payloads add `content.subType = "live"` (and `prevContent.subType` for moved events).',
  'Docs describe these payloads with `eventType`; forge-sim injects the selected event separately as `event`.',
];

const CONTENT_TREE_NOTES = [
  'Atlassian docs say whiteboard, database, embed, and folder events share the same payload format as page/blog-post events.',
  'Sample payloads keep that shared shape and set `content.type` to the matching content kind.',
];

const LABEL_NOTES = [
  'Only one of `content`, `space`, or `template` is present in a real label event.',
  'Sample payloads use the content-level variant; space/template variants share the same top-level shape.',
];

const RELATION_NOTES = [
  '`relationData` is optional per Atlassian docs and may be absent for some relation names.',
  'Sample payload uses the documented user → content relationship variant.',
];

const CUSTOM_CONTENT_NOTES = [
  '`content.container` is optional for space-level custom content.',
  'Atlassian\'s example includes `content.version` even though the type snippet is inconsistent; the sample keeps `version`.',
];

const ATTACHMENT_NOTES = [
  'Atlassian\'s type reference says `attachment.extensions.fileSize` is a number, while the example serializes it as a string.',
  'Sample payload follows the type reference and uses a number.',
];

const CONFLUENCE_TRIGGER_EVENT_TEMPLATES: TriggerEventTemplate[] = [
  ...[
    'avi:confluence:liked:page',
    'avi:confluence:viewed:page',
    'avi:confluence:archived:page',
    'avi:confluence:unarchived:page',
    'avi:confluence:permissions_updated:page',
    'avi:confluence:trashed:page',
    'avi:confluence:restored:page',
    'avi:confluence:deleted:page',
    'avi:confluence:created:page',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'content' as const,
    event,
    samplePayload: makePageLikePayload(event, clone(PAGE_CONTENT)),
    notes: PAGE_OR_LIVE_NOTES,
  })),

  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:updated:page',
    samplePayload: makePageLikePayload('avi:confluence:updated:page', clone(PAGE_CONTENT), {
      updateTrigger: 'content_update',
    }),
    notes: PAGE_OR_LIVE_NOTES,
  },
  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:moved:page',
    samplePayload: makePageLikePayload('avi:confluence:moved:page', clone(PAGE_CONTENT), {
      prevContent: makeContent('page', 'A brand new page', {
        id: '838205441',
        status: 'current',
        title: 'A brand new page',
      }),
    }),
    notes: PAGE_OR_LIVE_NOTES,
  },
  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:copied:page',
    samplePayload: makePageLikePayload('avi:confluence:copied:page', clone(PAGE_CONTENT), {
      originContentId: '838205400',
    }),
    notes: PAGE_OR_LIVE_NOTES,
  },
  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:children_reordered:page',
    samplePayload: makePageLikePayload('avi:confluence:children_reordered:page', clone(PAGE_CONTENT), {
      oldSortedChildPageIds: ['838205450', '838205451', '838205452'],
      newSortedChildPageIds: ['838205452', '838205450', '838205451'],
    }),
    notes: PAGE_OR_LIVE_NOTES,
  },
  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:initialized:page',
    samplePayload: makePageLikePayload('avi:confluence:initialized:page', clone(LIVE_DOC_CONTENT)),
    notes: PAGE_OR_LIVE_NOTES,
  },
  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:started:page',
    samplePayload: makePageLikePayload('avi:confluence:started:page', clone(LIVE_DOC_CONTENT), {
      updateTrigger: 'first_session_completed',
    }),
    notes: PAGE_OR_LIVE_NOTES,
  },
  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:snapshotted:page',
    samplePayload: makePageLikePayload('avi:confluence:snapshotted:page', clone(LIVE_DOC_CONTENT), {
      updateTrigger: 'snapshot_created',
    }),
    notes: PAGE_OR_LIVE_NOTES,
  },
  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:published:page',
    samplePayload: makePageLikePayload('avi:confluence:published:page', clone(PAGE_CONTENT), {
      updateTrigger: 'live_doc_published',
    }),
    notes: [
      ...PAGE_OR_LIVE_NOTES,
      'This event is documented under live docs. Atlassian does not show whether `content.subType = "live"` is still present after conversion, so the sample uses a plain page payload.',
    ],
  },

  ...[
    'avi:confluence:created:blogpost',
    'avi:confluence:liked:blogpost',
    'avi:confluence:viewed:blogpost',
    'avi:confluence:permissions_updated:blogpost',
    'avi:confluence:trashed:blogpost',
    'avi:confluence:restored:blogpost',
    'avi:confluence:deleted:blogpost',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'content' as const,
    event,
    samplePayload: makePageLikePayload(event, clone(BLOGPOST_CONTENT)),
    notes: ['Blog-post events share the same payload format as page/live-doc events.'],
  })),
  {
    product: 'confluence',
    family: 'content',
    event: 'avi:confluence:updated:blogpost',
    samplePayload: makePageLikePayload('avi:confluence:updated:blogpost', clone(BLOGPOST_CONTENT), {
      updateTrigger: 'content_update',
    }),
    notes: ['Blog-post events share the same payload format as page/live-doc events.'],
  },

  ...[
    ['avi:confluence:created:whiteboard', WHITEBOARD_CONTENT],
    ['avi:confluence:moved:whiteboard', WHITEBOARD_CONTENT],
    ['avi:confluence:copied:whiteboard', WHITEBOARD_CONTENT],
    ['avi:confluence:permissions_updated:whiteboard', WHITEBOARD_CONTENT],
    ['avi:confluence:created:database', DATABASE_CONTENT],
    ['avi:confluence:moved:database', DATABASE_CONTENT],
    ['avi:confluence:copied:database', DATABASE_CONTENT],
    ['avi:confluence:permissions_updated:database', DATABASE_CONTENT],
    ['avi:confluence:created:embed', EMBED_CONTENT],
    ['avi:confluence:moved:embed', EMBED_CONTENT],
    ['avi:confluence:copied:embed', EMBED_CONTENT],
    ['avi:confluence:created:folder', FOLDER_CONTENT],
    ['avi:confluence:moved:folder', FOLDER_CONTENT],
    ['avi:confluence:copied:folder', FOLDER_CONTENT],
    ['avi:confluence:permissions_updated:folder', FOLDER_CONTENT],
  ].map(([event, content]) => ({
    product: 'confluence' as const,
    family: 'content' as const,
    event: event as string,
    samplePayload: makePageLikePayload(event as string, clone(content as Record<string, unknown>)),
    notes: CONTENT_TREE_NOTES,
  })),

  ...[
    'avi:confluence:created:task',
    'avi:confluence:removed:task',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'task' as const,
    event,
    samplePayload: makeBasePayload(event, {
      task: makeTask(),
      content: clone(PAGE_CONTENT),
    }, { includeSuppressNotifications: true }),
  })),
  {
    product: 'confluence',
    family: 'task',
    event: 'avi:confluence:updated:task',
    samplePayload: makeBasePayload('avi:confluence:updated:task', {
      task: makeTask({ status: 'complete', statusAsString: 'CHECKED' }),
      oldTask: makeTask(),
      content: clone(PAGE_CONTENT),
    }, { includeSuppressNotifications: true }),
    notes: ['Only updated task events include `oldTask`.'],
  },

  ...[
    'avi:confluence:created:comment',
    'avi:confluence:liked:comment',
    'avi:confluence:deleted:comment',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'comment' as const,
    event,
    samplePayload: makeBasePayload(event, {
      content: makeCommentContent(),
    }, { includeSuppressNotifications: true }),
  })),
  {
    product: 'confluence',
    family: 'comment',
    event: 'avi:confluence:updated:comment',
    samplePayload: makeBasePayload('avi:confluence:updated:comment', {
      updateTrigger: 'content_update',
      content: makeCommentContent(),
    }, { includeSuppressNotifications: true }),
  },

  ...[
    'avi:confluence:created:space:V2',
    'avi:confluence:updated:space:V2',
    'avi:confluence:permissions_updated:space:V2',
    'avi:confluence:deleted:space:V2',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'space' as const,
    event,
    samplePayload: makeBasePayload(event, {
      space: clone(SAMPLE_SPACE_WITH_HISTORY),
    }),
  })),

  ...[
    'avi:confluence:created:attachment',
    'avi:confluence:viewed:attachment',
    'avi:confluence:archived:attachment',
    'avi:confluence:unarchived:attachment',
    'avi:confluence:trashed:attachment',
    'avi:confluence:restored:attachment',
    'avi:confluence:deleted:attachment',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'attachment' as const,
    event,
    samplePayload: makeBasePayload(event, {
      attachment: makeAttachment(),
    }, { includeSuppressNotifications: true }),
    notes: ATTACHMENT_NOTES,
  })),
  {
    product: 'confluence',
    family: 'attachment',
    event: 'avi:confluence:updated:attachment',
    samplePayload: makeBasePayload('avi:confluence:updated:attachment', {
      updateTrigger: 'content_update',
      attachment: makeAttachment(),
    }, { includeSuppressNotifications: true }),
    notes: ATTACHMENT_NOTES,
  },

  ...[
    'avi:confluence:created:custom_content',
    'avi:confluence:permissions_updated:custom_content',
    'avi:confluence:trashed:custom_content',
    'avi:confluence:restored:custom_content',
    'avi:confluence:deleted:custom_content',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'customContent' as const,
    event,
    samplePayload: makeBasePayload(event, {
      content: makeCustomContent(),
    }, { includeSuppressNotifications: true }),
    notes: CUSTOM_CONTENT_NOTES,
  })),
  {
    product: 'confluence',
    family: 'customContent',
    event: 'avi:confluence:updated:custom_content',
    samplePayload: makeBasePayload('avi:confluence:updated:custom_content', {
      updateTrigger: 'content_update',
      content: makeCustomContent(),
    }, { includeSuppressNotifications: true }),
    notes: CUSTOM_CONTENT_NOTES,
  },

  ...[
    'avi:confluence:created:label',
    'avi:confluence:added:label',
    'avi:confluence:removed:label',
    'avi:confluence:deleted:label',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'label' as const,
    event,
    samplePayload: makeBasePayload(event, {
      label: clone(SAMPLE_LABEL),
      content: makeLabelContent(),
    }),
    notes: LABEL_NOTES,
  })),

  ...[
    'avi:confluence:created:user',
    'avi:confluence:deleted:user',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'user' as const,
    event,
    samplePayload: makeBasePayload(event, {
      user: clone(SAMPLE_USER),
    }, { includeAtlassianId: false }),
    notes: ['Atlassian docs explicitly omit `atlassianId` for user events.'],
  })),

  ...[
    'avi:confluence:created:group',
    'avi:confluence:deleted:group',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'group' as const,
    event,
    samplePayload: makeBasePayload(event, {
      group: {
        id: 'ab1a3479-143a-456e-8853-d359e577863a',
        name: 'example-group',
      },
    }, { includeAtlassianId: false }),
    notes: ['Atlassian docs explicitly omit `atlassianId` for group events.'],
  })),

  ...[
    'avi:confluence:created:relation',
    'avi:confluence:deleted:relation',
  ].map((event) => ({
    product: 'confluence' as const,
    family: 'relation' as const,
    event,
    samplePayload: makeBasePayload(event, {
      relationName: 'watching',
      relationData: {
        createdBy: clone(SAMPLE_USER),
        createdDate: SAMPLE_TIMESTAMP,
      },
      source: {
        user: clone(SAMPLE_USER),
      },
      target: {
        content: makeContent('page', 'A brand new page', { subType: 'live' }),
      },
    }),
    notes: RELATION_NOTES,
  })),

  {
    product: 'confluence',
    family: 'search',
    event: 'avi:confluence:performed:search',
    samplePayload: makeBasePayload('avi:confluence:performed:search', {
      query: 'test search',
      accountType: 'atlassian',
      results: 2,
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Jira sample payload helpers
// ─────────────────────────────────────────────────────────────────────────────

const JIRA_SAMPLE_TIMESTAMP = '1716300000000'; // epoch ms as string (2024-05-21T14:00:00Z)
const JIRA_SAMPLE_ACCOUNT_ID = 'abc123def456ghi789jk0lmn';
const JIRA_SAMPLE_ACCOUNT_ID_2 = 'zyx987wvu654tsr321qpo';

const JIRA_SAMPLE_AVATAR_URLS = {
  '16x16': 'https://secure.gravatar.com/avatar/sample?d=mm&s=16',
  '24x24': 'https://secure.gravatar.com/avatar/sample?d=mm&s=24',
  '32x32': 'https://secure.gravatar.com/avatar/sample?d=mm&s=32',
  '48x48': 'https://secure.gravatar.com/avatar/sample?d=mm&s=48',
};

const JIRA_SAMPLE_USER = {
  accountId: JIRA_SAMPLE_ACCOUNT_ID,
  accountType: 'atlassian',
  displayName: 'Alice Smith',
  emailAddress: 'alice@example.com',
  avatarUrls: clone(JIRA_SAMPLE_AVATAR_URLS),
  active: true,
  timeZone: 'America/New_York',
};

const JIRA_SAMPLE_USER_DETAILS = {
  ...JIRA_SAMPLE_USER,
  locale: 'en_US',
  groups: {
    size: 1,
    items: [{ name: 'jira-software-users', self: 'https://api.atlassian.com/ex/jira/abcdef/rest/api/3/group?groupId=grp1' }],
  },
  applicationRoles: {
    size: 1,
    items: [{ key: 'jira-software', name: 'Jira Software' }],
  },
};

const JIRA_SAMPLE_STATUS = {
  id: '10001',
  name: 'In Progress',
  description: 'Work is actively underway.',
  iconUrl: 'https://example.atlassian.net/images/icons/statuses/inprogress.png',
  statusCategory: {
    id: 4,
    key: 'indeterminate',
    name: 'In Progress',
    colorName: 'yellow',
  },
};

const JIRA_SAMPLE_STATUS_TODO = {
  id: '10000',
  name: 'To Do',
  description: 'Work has not started.',
  iconUrl: 'https://example.atlassian.net/images/icons/statuses/todo.png',
  statusCategory: {
    id: 2,
    key: 'new',
    name: 'To Do',
    colorName: 'blue-gray',
  },
};

const JIRA_SAMPLE_ISSUETYPE = {
  id: '10001',
  name: 'Story',
  description: 'A user story.',
  iconUrl: 'https://example.atlassian.net/images/icons/issuetypes/story.png',
  subtask: false,
  hierarchyLevel: 0,
};

const JIRA_SAMPLE_PROJECT = {
  id: '10000',
  key: 'DEMO',
  name: 'Demo Project',
  projectTypeKey: 'software',
  simplified: false,
  lead: clone(JIRA_SAMPLE_USER),
  avatarUrls: clone(JIRA_SAMPLE_AVATAR_URLS),
  self: 'https://example.atlassian.net/rest/api/3/project/10000',
};

function makeJiraIssue(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: '100001',
    key: 'DEMO-42',
    self: 'https://example.atlassian.net/rest/api/3/issue/100001',
    fields: {
      summary: 'Implement login screen',
      status: clone(JIRA_SAMPLE_STATUS),
      assignee: clone(JIRA_SAMPLE_USER),
      reporter: clone(JIRA_SAMPLE_USER),
      priority: { id: '3', name: 'Medium', iconUrl: 'https://example.atlassian.net/images/icons/priorities/medium.png' },
      issuetype: clone(JIRA_SAMPLE_ISSUETYPE),
      project: clone(JIRA_SAMPLE_PROJECT),
      created: '2024-05-20T10:00:00.000+0000',
      updated: '2024-05-21T14:00:00.000+0000',
      labels: ['backend', 'auth'],
      ...((overrides.fields ?? {}) as Record<string, unknown>),
    },
    ...overrides,
  };
}

function makeJiraComment(): Record<string, unknown> {
  return {
    id: '200001',
    author: clone(JIRA_SAMPLE_USER),
    updateAuthor: clone(JIRA_SAMPLE_USER),
    body: 'This looks good. Will review by EOD.',
    created: '2024-05-21T12:00:00.000+0000',
    updated: '2024-05-21T12:05:00.000+0000',
    jsdPublic: true,
  };
}

function makeJiraChangelog(items: Array<Record<string, unknown>> = []): Record<string, unknown> {
  return {
    id: '300001',
    items: items.length > 0 ? items : [
      {
        field: 'status',
        fieldtype: 'jira',
        fieldId: 'status',
        from: '10000',
        fromString: 'To Do',
        to: '10001',
        toString: 'In Progress',
      },
    ],
  };
}

function makeJiraVersion(id = '50001', name = '1.0.0'): Record<string, unknown> {
  return {
    id,
    name,
    description: 'Initial release',
    projectId: 10000,
    released: false,
    archived: false,
    releaseDate: '2024-06-30',
    startDate: '2024-05-01',
    userReleaseDate: '30/Jun/24',
    overdue: false,
    self: `https://example.atlassian.net/rest/api/3/version/${id}`,
  };
}

function makeJiraBasePayload(
  eventType: string,
  extra: Record<string, unknown>,
  options?: { includeAtlassianId?: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    eventType,
    timestamp: JIRA_SAMPLE_TIMESTAMP,
  };
  if (options?.includeAtlassianId !== false) {
    payload.atlassianId = JIRA_SAMPLE_ACCOUNT_ID;
  }
  return { ...payload, ...extra };
}

const JIRA_ISSUE_NOTES = [
  'Jira event payloads use `timestamp` (epoch ms as string) rather than `eventCreatedDate`.',
  '`atlassianId` is optional on most issue events; only `avi:jira:viewed:issue` documents it as required.',
  '`issue.fields` contains all standard and custom field values. Only a representative subset is shown in the sample.',
];

const JIRA_WORKLOG_NOTES = [
  'For deleted worklogs, cascading events are not emitted.',
  '`worklog.comment` may be an Atlassian Document Format (ADF) object or a plain string depending on API version.',
];

const JIRA_VERSION_NOTES = [
  '`mergedVersion`, `newAffectsVersion`, `newFixVersion`, and `customFieldReplacements` are only present on the `deleted` event.',
  'The `merged` event may also include `mergedVersion`.',
];

const JIRA_FILTER_NOTES = [
  'Docs do not show a detailed type reference for Filter; fields are based on the Jira REST API v3 filter schema.',
];

const JIRA_CUSTOM_FIELD_CONTEXT_CONFIG_NOTE = [
  'Only one event exists for this type: `avi:jira:updated:field:context:configuration`.',
  '`configuration` is a stringified JSON blob whose internal shape depends on the custom field type.',
];

const JIRA_EXPRESSION_FAILED_NOTES = [
  'Either `conditionId` or `validatorId` is present (not both), indicating which workflow extension failed.',
];

const JIRA_POST_FUNCTION_NOTES = [
  'This is a post-function invocation payload, not a subscribe-style trigger event.',
  'It is triggered by workflow transitions with a configured Forge post function.',
  'The `context` field is only available for function handlers; endpoint handlers receive context via the authorization header.',
];

const JIRA_USER_NOTES = [
  'User created/updated events return `UserDetails` (with groups/roles); user deleted returns a simpler `User` object.',
];

const JIRA_TRIGGER_EVENT_TEMPLATES: TriggerEventTemplate[] = [
  // ── Issue events ────────────────────────────────────────────────────────────
  {
    product: 'jira',
    family: 'issue',
    event: 'avi:jira:created:issue',
    samplePayload: makeJiraBasePayload('avi:jira:created:issue', {
      issue: makeJiraIssue(),
      associatedUsers: { users: [clone(JIRA_SAMPLE_USER)] },
    }),
    notes: JIRA_ISSUE_NOTES,
  },
  {
    product: 'jira',
    family: 'issue',
    event: 'avi:jira:updated:issue',
    samplePayload: makeJiraBasePayload('avi:jira:updated:issue', {
      issue: makeJiraIssue(),
      changelog: makeJiraChangelog(),
      jiraEventTypeName: 'issue_generic',
      associatedUsers: { users: [clone(JIRA_SAMPLE_USER)] },
      associatedStatuses: {
        statuses: [clone(JIRA_SAMPLE_STATUS_TODO), clone(JIRA_SAMPLE_STATUS)],
      },
    }),
    notes: [
      ...JIRA_ISSUE_NOTES,
      '`jiraEventTypeName` is a sub-type hint (e.g. issue_resolved, issue_moved, issue_generic). Only present on created/updated events.',
      '`associatedStatuses` is only present when the status field changes.',
    ],
  },
  {
    product: 'jira',
    family: 'issue',
    event: 'avi:jira:deleted:issue',
    samplePayload: makeJiraBasePayload('avi:jira:deleted:issue', {
      issue: makeJiraIssue(),
      associatedUsers: { users: [clone(JIRA_SAMPLE_USER)] },
    }),
    notes: [...JIRA_ISSUE_NOTES, 'Cascading events (sub-tasks, linked issues) are NOT emitted when an issue is deleted.'],
  },
  {
    product: 'jira',
    family: 'issue',
    event: 'avi:jira:assigned:issue',
    samplePayload: makeJiraBasePayload('avi:jira:assigned:issue', {
      issue: makeJiraIssue(),
      changelog: makeJiraChangelog([
        {
          field: 'assignee',
          fieldtype: 'jira',
          fieldId: 'assignee',
          from: null,
          fromString: null,
          to: JIRA_SAMPLE_ACCOUNT_ID,
          toString: 'Alice Smith',
        },
      ]),
      associatedUsers: { users: [clone(JIRA_SAMPLE_USER)] },
    }),
    notes: [
      ...JIRA_ISSUE_NOTES,
      'An avi:jira:updated:issue event is also sent alongside this event.',
      '`changelog.items[].from` and `.to` are account IDs (or null for unassigned).',
    ],
  },
  {
    product: 'jira',
    family: 'issue',
    event: 'avi:jira:viewed:issue',
    samplePayload: {
      eventType: 'avi:jira:viewed:issue',
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      issue: makeJiraIssue(),
      atlassianId: JIRA_SAMPLE_ACCOUNT_ID,
      user: clone(JIRA_SAMPLE_USER),
    },
    notes: [
      ...JIRA_ISSUE_NOTES,
      '`atlassianId` is documented as required (not optional) for viewed events.',
      '`user` object is also present on viewed events, unlike most other issue events.',
    ],
  },
  {
    product: 'jira',
    family: 'issue',
    event: 'avi:jira:mentioned:issue',
    samplePayload: makeJiraBasePayload('avi:jira:mentioned:issue', {
      issue: makeJiraIssue(),
      mentionedAccountIds: [JIRA_SAMPLE_ACCOUNT_ID_2],
    }),
    notes: [
      ...JIRA_ISSUE_NOTES,
      'Sent when the issue description is updated and users are @mentioned. Self-mentions do not trigger this event.',
    ],
  },

  // ── Issue link events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:issuelink',
    'avi:jira:deleted:issuelink',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'issueLink' as const,
    event,
    samplePayload: {
      eventType: event,
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      id: '60001',
      sourceIssueId: '100001',
      destinationIssueId: '100002',
      sourceProjectId: '10000',
      destinationProjectId: '10000',
      issueLinkType: {
        id: '10000',
        name: 'Blocks',
        inward: 'is blocked by',
        outward: 'blocks',
        self: 'https://example.atlassian.net/rest/api/3/issueLinkType/10000',
      },
    },
    notes: ['Only intra-instance issue links trigger events. Cross-instance links are not supported.'],
  })),

  // ── Worklog events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:worklog',
    'avi:jira:updated:worklog',
    'avi:jira:deleted:worklog',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'worklog' as const,
    event,
    samplePayload: {
      eventType: event,
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      worklog: {
        id: '70001',
        issueId: '100001',
        author: clone(JIRA_SAMPLE_USER),
        updateAuthor: clone(JIRA_SAMPLE_USER),
        comment: 'Fixed the login bug.',
        timeSpent: '2h',
        timeSpentSeconds: 7200,
        started: '2024-05-21T09:00:00.000+0000',
        created: '2024-05-21T09:00:00.000+0000',
        updated: '2024-05-21T09:05:00.000+0000',
        self: 'https://example.atlassian.net/rest/api/3/issue/100001/worklog/70001',
      },
    },
    notes: JIRA_WORKLOG_NOTES,
  })),

  // ── Issue type events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:issuetype',
    'avi:jira:updated:issuetype',
    'avi:jira:deleted:issuetype',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'issueType' as const,
    event,
    samplePayload: makeJiraBasePayload(event, {
      issueType: {
        id: '10005',
        name: 'Epic',
        description: 'A large user story that needs to be broken down.',
        iconUrl: 'https://example.atlassian.net/images/icons/issuetypes/epic.png',
        subtask: false,
        hierarchyLevel: 1,
      },
    }),
    notes: [
      'Requires manage:jira-configuration scope (classic) or read:issue-type:jira (granular).',
      'All three issue type events share the same payload format.',
    ],
  })),

  // ── Comment events ────────────────────────────────────────────────────────
  {
    product: 'jira',
    family: 'comment',
    event: 'avi:jira:commented:issue',
    samplePayload: makeJiraBasePayload('avi:jira:commented:issue', {
      issue: makeJiraIssue(),
      comment: makeJiraComment(),
      associatedUsers: { users: [clone(JIRA_SAMPLE_USER)] },
    }),
    notes: ['Sent for both comment creation and editing.'],
  },
  {
    product: 'jira',
    family: 'comment',
    event: 'avi:jira:mentioned:comment',
    samplePayload: makeJiraBasePayload('avi:jira:mentioned:comment', {
      issue: makeJiraIssue(),
      comment: makeJiraComment(),
      mentionedAccountIds: [JIRA_SAMPLE_ACCOUNT_ID_2],
    }),
    notes: ['Sent when users are @mentioned in a new or edited comment. All mentions are batched into one event.'],
  },
  {
    product: 'jira',
    family: 'comment',
    event: 'avi:jira:deleted:comment',
    samplePayload: makeJiraBasePayload('avi:jira:deleted:comment', {
      issue: makeJiraIssue(),
      comment: makeJiraComment(),
    }),
    notes: ['Cascading comment deletions (e.g. from issue deletion) do NOT emit this event.'],
  },

  // ── Custom field events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:field',
    'avi:jira:updated:field',
    'avi:jira:trashed:field',
    'avi:jira:restored:field',
    'avi:jira:deleted:field',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'customField' as const,
    event,
    samplePayload: {
      eventType: event,
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      id: 'customfield_10100',
      key: 'com.example.forge-app__my-custom-field',
      type: 'com.atlassian.jira.plugin.system.customfieldtypes:textfield',
      typeName: 'Text Field (single line)',
      name: 'Customer Ticket ID',
      description: 'The related ticket ID in the customer support system.',
    },
    notes: [
      'Requires manage:jira-configuration scope.',
      'All five custom field events share the same payload format.',
      'Docs do not specify a type reference; fields are based on the documented payload table.',
    ],
  })),

  // ── Custom field context events ────────────────────────────────────────────────
  ...[
    'avi:jira:created:field:context',
    'avi:jira:updated:field:context',
    'avi:jira:deleted:field:context',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'customFieldContext' as const,
    event,
    samplePayload: {
      eventType: event,
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      id: '10200',
      fieldId: 'customfield_10100',
      fieldKey: 'com.example.forge-app__my-custom-field',
      name: 'Default Context',
      description: 'Applied to all projects and issue types.',
      projectIds: [],
      issueTypeIds: [],
    },
    notes: [
      'Requires manage:jira-configuration scope.',
      'Empty `projectIds` means global context; empty `issueTypeIds` means all issue types.',
    ],
  })),

  // ── Custom field context configuration event ──────────────────────────────────
  {
    product: 'jira',
    family: 'customFieldContext',
    event: 'avi:jira:updated:field:context:configuration',
    samplePayload: {
      eventType: 'avi:jira:updated:field:context:configuration',
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      customFieldId: 'customfield_10100',
      customFieldKey: 'com.example.forge-app__my-custom-field',
      configurationId: 10300,
      fieldContextId: 10200,
      configuration: '{"defaultValue":"N/A","isRequired":true}',
    },
    notes: JIRA_CUSTOM_FIELD_CONTEXT_CONFIG_NOTE,
  },

  // ── Workflow: expression failed ────────────────────────────────────────────────
  {
    product: 'jira',
    family: 'workflow',
    event: 'avi:jira:failed:expression',
    samplePayload: {
      eventType: 'avi:jira:failed:expression',
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      extensionId: 'ari:cloud:ecosystem::extension/app-key/env-id/static/my-condition',
      workflowId: 'workflow-uuid-1234',
      workflowName: 'Software Development Workflow',
      conditionId: 'condition-uuid-5678',
      expression: 'issue.status.name == "Done"',
      errorMessages: ['Cannot read property "name" of undefined'],
      context: {
        issue: { id: '100001', key: 'DEMO-42' },
        project: { id: '10000', key: 'DEMO' },
      },
    },
    notes: JIRA_EXPRESSION_FAILED_NOTES,
  },

  // ── Version events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:version',
    'avi:jira:updated:version',
    'avi:jira:released:version',
    'avi:jira:unreleased:version',
    'avi:jira:archived:version',
    'avi:jira:unarchived:version',
    'avi:jira:moved:version',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'version' as const,
    event,
    samplePayload: makeJiraBasePayload(event, {
      version: makeJiraVersion(),
    }),
    notes: JIRA_VERSION_NOTES,
  })),
  {
    product: 'jira',
    family: 'version',
    event: 'avi:jira:merged:version',
    samplePayload: makeJiraBasePayload('avi:jira:merged:version', {
      version: makeJiraVersion('50001', '1.0.0'),
      mergedVersion: makeJiraVersion('50002', '1.1.0'),
    }),
    notes: JIRA_VERSION_NOTES,
  },
  {
    product: 'jira',
    family: 'version',
    event: 'avi:jira:deleted:version',
    samplePayload: makeJiraBasePayload('avi:jira:deleted:version', {
      version: makeJiraVersion('50001', '1.0.0'),
      newAffectsVersion: makeJiraVersion('50003', '2.0.0'),
      newFixVersion: makeJiraVersion('50003', '2.0.0'),
      customFieldReplacements: [],
    }),
    notes: [
      ...JIRA_VERSION_NOTES,
      '`newAffectsVersion` and `newFixVersion` are only present if a replacement version was specified.',
    ],
  },

  // ── Project events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:project',
    'avi:jira:updated:project',
    'avi:jira:softdeleted:project',
    'avi:jira:deleted:project',
    'avi:jira:archived:project',
    'avi:jira:unarchived:project',
    'avi:jira:restored:project',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'project' as const,
    event,
    samplePayload: {
      eventType: event,
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      project: clone(JIRA_SAMPLE_PROJECT),
    },
    notes: ['All project events share the same payload format. Docs do not include `atlassianId` for project events.'],
  })),

  // ── Attachment events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:attachment',
    'avi:jira:deleted:attachment',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'attachment' as const,
    event,
    samplePayload: {
      eventType: event,
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      attachment: {
        id: '80001',
        author: clone(JIRA_SAMPLE_USER),
        filename: 'screenshot.png',
        created: '2024-05-21T11:00:00.000+0000',
        size: 45678,
        mimeType: 'image/png',
        content: 'https://example.atlassian.net/secure/attachment/80001/screenshot.png',
        self: 'https://example.atlassian.net/rest/api/3/attachment/80001',
      },
    },
    notes: ['Cascading attachment deletions are not emitted. Docs do not include `atlassianId` for attachment events.'],
  })),

  // ── Component events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:component',
    'avi:jira:updated:component',
    'avi:jira:deleted:component',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'component' as const,
    event,
    samplePayload: makeJiraBasePayload(event, {
      component: {
        id: '90001',
        name: 'Authentication',
        description: 'Login and session management.',
        lead: clone(JIRA_SAMPLE_USER),
        leadAccountId: JIRA_SAMPLE_ACCOUNT_ID,
        assigneeType: 'PROJECT_DEFAULT',
        realAssigneeType: 'PROJECT_DEFAULT',
        isAssigneeTypeValid: true,
        project: 'DEMO',
        projectId: 10000,
        self: 'https://example.atlassian.net/rest/api/3/component/90001',
      },
    }),
    notes: ['Cascading deletions on component delete are not emitted.'],
  })),

  // ── User events ────────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:user',
    'avi:jira:updated:user',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'user' as const,
    event,
    samplePayload: {
      eventType: event,
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      user: clone(JIRA_SAMPLE_USER_DETAILS),
    },
    notes: JIRA_USER_NOTES,
  })),
  {
    product: 'jira',
    family: 'user',
    event: 'avi:jira:deleted:user',
    samplePayload: {
      eventType: 'avi:jira:deleted:user',
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      user: clone(JIRA_SAMPLE_USER),
    },
    notes: JIRA_USER_NOTES,
  },

  // ── Filter events ────────────────────────────────────────────────────────
  ...[
    'avi:jira:created:filter',
    'avi:jira:updated:filter',
    'avi:jira:deleted:filter',
  ].map((event) => ({
    product: 'jira' as const,
    family: 'filter' as const,
    event,
    samplePayload: makeJiraBasePayload(event, {
      filter: {
        id: '12345',
        name: 'My open issues',
        description: 'All open issues assigned to me.',
        owner: clone(JIRA_SAMPLE_USER),
        jql: 'assignee = currentUser() AND statusCategory != Done',
        viewUrl: 'https://example.atlassian.net/issues/?filter=12345',
        sharePermissions: [],
        editPermissions: [],
        self: 'https://example.atlassian.net/rest/api/3/filter/12345',
      },
    }),
    notes: JIRA_FILTER_NOTES,
  })),

  // ── Time tracking provider event ──────────────────────────────────────────
  {
    product: 'jira',
    family: 'configuration',
    event: 'avi:jira:timetracking:provider:changed',
    samplePayload: {
      eventType: 'avi:jira:timetracking:provider:changed',
      timestamp: JIRA_SAMPLE_TIMESTAMP,
      property: {
        key: 'jira.timetracking.selected',
        value: 'JIRA',
      },
    },
    notes: [
      'Only one event type exists for time tracking changes.',
      '`property.value` is the key of the selected provider (e.g. "JIRA" for the built-in tracker).',
    ],
  },

  // ── Configuration event ──────────────────────────────────────────────────
  {
    product: 'jira',
    family: 'configuration',
    event: 'avi:jira:changed:configuration',
    samplePayload: makeJiraBasePayload('avi:jira:changed:configuration', {
      property: {
        key: 'jira.option.watching',
        value: 'true',
      },
    }),
    notes: [
      'Valid `property.key` values: jira.option.allowsubtasks, jira.option.allowunassigned, jira.option.voting, jira.option.watching, jira.option.issuelinking.',
      '`property.value` is a string "true" or "false" despite representing a boolean.',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// App Lifecycle sample payload templates (avi:forge:*)
// ─────────────────────────────────────────────────────────────────────────────

const APP_LIFECYCLE_APP = {
  id: '406d303d-0393-4ec4-ad7c-1435be94583a',
  version: '9.0.0',
  name: 'My App Name',
  ownerAccountId: '3bc8aa0c52dc1b310a791d34',
};

const APP_LIFECYCLE_ENVIRONMENT = {
  id: '23863033-1de4-4ebf-b30d-c906264a1e92',
};

const APP_LIFECYCLE_INSTALLATION_ID = 'fff8e466-31f4-4c73-a337-c3309dd930dc';
const APP_LIFECYCLE_INSTALLER_ACCOUNT_ID = '4ad9aa0c52dc1b420a791d12';

const APP_LIFECYCLE_NOTES = [
  'Unlike Jira/Confluence events, app lifecycle event payloads do NOT include an `eventType` field.',
  'The event name is only available as the first argument to your handler function, not in the payload.',
];

const APP_LIFECYCLE_TRIGGER_EVENT_TEMPLATES: TriggerEventTemplate[] = [
  {
    product: 'app-lifecycle',
    family: 'lifecycle',
    event: 'avi:forge:installed:app',
    samplePayload: {
      id: APP_LIFECYCLE_INSTALLATION_ID,
      installerAccountId: APP_LIFECYCLE_INSTALLER_ACCOUNT_ID,
      app: clone(APP_LIFECYCLE_APP),
      environment: clone(APP_LIFECYCLE_ENVIRONMENT),
    },
    notes: [
      ...APP_LIFECYCLE_NOTES,
      '`installerAccountId` is optional — may be absent for system-triggered installs.',
      'During installation, API calls using .asApp() may fail with 401/403 until the app account is fully initialised. Use retry handling.',
    ],
  },
  {
    product: 'app-lifecycle',
    family: 'lifecycle',
    event: 'avi:forge:upgraded:app',
    samplePayload: {
      id: APP_LIFECYCLE_INSTALLATION_ID,
      upgraderAccountId: APP_LIFECYCLE_INSTALLER_ACCOUNT_ID,
      app: clone(APP_LIFECYCLE_APP),
      environment: clone(APP_LIFECYCLE_ENVIRONMENT),
      permissions: {
        scopes: ['read:jira-work', 'write:jira-work'],
        external: {
          fetch: {
            backend: ['https://api.example.com'],
          },
        },
      },
    },
    notes: [
      ...APP_LIFECYCLE_NOTES,
      'Only sent for MAJOR version upgrades. Minor and patch upgrades do not trigger this event.',
      '`upgraderAccountId` is optional.',
      '`permissions` describes the scopes and external egress the new version has been granted.',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Jira Software sample payload templates (avi:jira-software:*)
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: The task referenced https://developer.atlassian.com/platform/forge/events-reference/jira-service-management/
// which returns 404. The Jira Software events page at events-reference/jira-software/ is the
// documented product-specific events page covering boards and sprints. These are implemented
// here under product 'jira-software'. There are no separately documented JSM (Jira Service
// Management) trigger events in the Forge events reference as of March 2026.

const JIRA_SW_TIMESTAMP = '1716300000000';
const JIRA_SW_ACCOUNT_ID = '5c37e3bdb393bf4ce95658d5';

const JIRA_SW_BOARD_NOTES = [
  'Board id is typed as string in the interface but docs show integer examples (e.g. 11). Coerce as needed.',
  'Cascading events for deleted boards are NOT emitted.',
];

const JIRA_SW_SPRINT_NOTES = [
  '`oldValue` is only present on the `avi:jira-software:updated:sprint` event and contains only the changed fields.',
  'Sprint `name` is limited to 30 characters; `goal` is limited to 10000 characters.',
  '`startDate`, `endDate`, and `completeDate` may be absent on future sprints that have not been started.',
];

const JIRA_SOFTWARE_TRIGGER_EVENT_TEMPLATES: TriggerEventTemplate[] = [
  // ── Board created / updated / deleted ──────────────────────────────────────
  ...[
    'avi:jira-software:created:board',
    'avi:jira-software:updated:board',
    'avi:jira-software:deleted:board',
  ].map((event) => ({
    product: 'jira-software' as const,
    family: 'board' as const,
    event,
    samplePayload: {
      eventType: event,
      board: {
        id: '11',
        name: 'Some SCRUM board',
        type: 'scrum',
      },
      atlassianId: JIRA_SW_ACCOUNT_ID,
    },
    notes: JIRA_SW_BOARD_NOTES,
  })),

  // ── Board configuration changed ────────────────────────────────────────────
  {
    product: 'jira-software',
    family: 'board',
    event: 'avi:jira-software:configuration-changed:board',
    samplePayload: {
      eventType: 'avi:jira-software:configuration-changed:board',
      configuration: {
        id: 11,
        name: 'CMPSCRUM board',
        type: 'scrum',
        location: {
          type: 'project',
          key: 'CMPSCRUM',
          id: '10005',
          name: 'cmpscrum',
        },
        filter: {
          id: '10007',
        },
        columnConfig: {
          columns: [
            { name: 'To Do', statuses: [{ id: '10006' }] },
            { name: 'In Progress', statuses: [{ id: '3' }] },
            { name: 'Done', statuses: [{ id: '10007' }] },
          ],
          constraintType: 'none',
        },
        estimation: {
          type: 'field',
          field: {
            fieldId: 'customfield_10214',
            displayName: 'Story Points',
          },
        },
        ranking: {
          rankCustomFieldId: 10019,
        },
      },
      atlassianId: '655363:f4dec1e8-6b1a-48aa-a9bf-e03d10b4abba',
    },
    notes: [
      'The `configuration.id` is the board id (integer), not a separate configuration ID.',
      '`estimation` and `location` are optional; they may be absent for simpler board types.',
      '`subQuery` is also optional and not shown in this sample.',
    ],
  },

  // ── Sprint events ──────────────────────────────────────────────────────────
  ...[
    'avi:jira-software:created:sprint',
    'avi:jira-software:started:sprint',
    'avi:jira-software:closed:sprint',
    'avi:jira-software:deleted:sprint',
  ].map((event) => ({
    product: 'jira-software' as const,
    family: 'sprint' as const,
    event,
    samplePayload: {
      eventType: event,
      sprint: {
        id: '6',
        originBoardId: '12',
        name: 'EX1 Sprint 1',
        goal: 'Ship the login feature',
        state: event === 'avi:jira-software:created:sprint' ? 'future' :
               event === 'avi:jira-software:started:sprint' ? 'active' :
               event === 'avi:jira-software:closed:sprint' ? 'closed' : 'future',
        createDate: '2024-09-24T10:59:20.334+0200',
        startDate: '2024-10-05T00:00:00.000+0200',
        endDate: '2024-10-12T00:00:00.000+0200',
      },
      atlassianId: JIRA_SW_ACCOUNT_ID,
    },
    notes: JIRA_SW_SPRINT_NOTES,
  })),
  {
    product: 'jira-software',
    family: 'sprint',
    event: 'avi:jira-software:updated:sprint',
    samplePayload: {
      eventType: 'avi:jira-software:updated:sprint',
      sprint: {
        id: '6',
        originBoardId: '12',
        name: 'EX1 Sprint 1',
        goal: 'The new goal',
        state: 'future',
        createDate: '2024-09-24T10:59:20.334+0200',
        startDate: '2024-10-05T00:00:00.000+0200',
        endDate: '2024-10-12T00:00:00.000+0200',
      },
      oldValue: {
        goal: 'The goal',
        startDate: '2024-10-03T00:00:00.000+0200',
        endDate: '2024-10-05T00:00:00.000+0200',
      },
      atlassianId: JIRA_SW_ACCOUNT_ID,
    },
    notes: [
      ...JIRA_SW_SPRINT_NOTES,
      '`oldValue` is only present on this event and contains only the fields that changed, not the full sprint object.',
    ],
  },
];

const ALL_TRIGGER_EVENT_TEMPLATES: TriggerEventTemplate[] = [
  ...CONFLUENCE_TRIGGER_EVENT_TEMPLATES,
  ...JIRA_TRIGGER_EVENT_TEMPLATES,
  ...APP_LIFECYCLE_TRIGGER_EVENT_TEMPLATES,
  ...JIRA_SOFTWARE_TRIGGER_EVENT_TEMPLATES,
];

const CONFLUENCE_TRIGGER_EVENT_TEMPLATE_MAP = new Map(
  CONFLUENCE_TRIGGER_EVENT_TEMPLATES.map((template) => [template.event, template]),
);

const ALL_TRIGGER_EVENT_TEMPLATE_MAP = new Map(
  ALL_TRIGGER_EVENT_TEMPLATES.map((template) => [template.event, template]),
);

export function getTriggerEventTemplate(eventName: string): TriggerEventTemplate | undefined {
  const template = ALL_TRIGGER_EVENT_TEMPLATE_MAP.get(eventName);
  return template ? clone(template) : undefined;
}

export function getTriggerEventTemplates(eventNames?: Iterable<string>): TriggerEventTemplate[] {
  if (!eventNames) {
    return clone(ALL_TRIGGER_EVENT_TEMPLATES);
  }

  const seen = new Set<string>();
  const templates: TriggerEventTemplate[] = [];
  for (const eventName of eventNames) {
    if (seen.has(eventName)) continue;
    seen.add(eventName);
    const template = getTriggerEventTemplate(eventName);
    if (template) templates.push(template);
  }
  return templates;
}

export function getTriggerEventTemplateMap(eventNames?: Iterable<string>): Record<string, TriggerEventTemplate> {
  return Object.fromEntries(
    getTriggerEventTemplates(eventNames).map((template) => [template.event, template]),
  );
}

export function getConfluenceLabelVariantSamples(): {
  content: Record<string, unknown>;
  space: Record<string, unknown>;
  template: Record<string, unknown>;
} {
  return {
    content: makeLabelContent(),
    space: makeLabelSpace(),
    template: makeLabelTemplate(),
  };
}
