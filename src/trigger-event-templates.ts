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
  product: 'confluence';
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
    | 'search';
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

const CONFLUENCE_TRIGGER_EVENT_TEMPLATE_MAP = new Map(
  CONFLUENCE_TRIGGER_EVENT_TEMPLATES.map((template) => [template.event, template]),
);

export function getTriggerEventTemplate(eventName: string): TriggerEventTemplate | undefined {
  const template = CONFLUENCE_TRIGGER_EVENT_TEMPLATE_MAP.get(eventName);
  return template ? clone(template) : undefined;
}

export function getTriggerEventTemplates(eventNames?: Iterable<string>): TriggerEventTemplate[] {
  if (!eventNames) {
    return clone(CONFLUENCE_TRIGGER_EVENT_TEMPLATES);
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
