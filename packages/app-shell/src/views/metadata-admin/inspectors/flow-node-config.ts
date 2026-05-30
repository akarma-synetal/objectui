// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-node-config — declarative, spec-precise config-field schema per flow
 * node type.
 *
 * Node types and the structured config blocks below mirror the authoritative
 * `@objectstack/spec` FlowNode schema (automation/flow.zod.ts): the type enum
 * is the spec's `FlowNodeAction`, and spec-schematized blocks — `waitEventConfig`
 * (wait), `connectorConfig` (connector_action), `boundaryConfig`
 * (boundary_event) and the node-level `timeoutMs` — are edited as precise form
 * fields rather than free JSON.
 *
 * Each field declares a `path` into the node object. Most CRUD/script/http
 * fields live under `['config', key]` (the spec's freeform, type-specific
 * config record); spec-structured blocks live at the node top level, e.g.
 * `['waitEventConfig', 'eventType']`. Only fields whose path is rooted at
 * `config` "own" a config key — any *other* config keys remain editable in the
 * optional Advanced block so authors are never locked out.
 *
 * Field kinds: scalar (text / expression / number / boolean / select),
 * `textarea` (script code, request body) and `keyValue` for flat object maps
 * (e.g. record field values, connector input). Deeply nested / array values
 * still fall back to the optional Advanced block.
 */

export type FlowConfigFieldKind =
  | 'text'
  | 'expression'
  | 'number'
  | 'boolean'
  | 'select'
  | 'textarea'
  | 'keyValue'
  | 'stringList'
  | 'objectList';

/** Column descriptor for an `objectList` repeater row. */
export interface FlowConfigColumn {
  key: string;
  label: string;
  kind: 'text' | 'expression' | 'boolean' | 'select';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}

export interface FlowConfigField {
  /**
   * Stable field identity — used as the React key and as the `showWhen.field`
   * reference. Distinct from the storage path so nested-path fields stay
   * unambiguous (e.g. `wait.timerDuration`).
   */
  id: string;
  /**
   * Location of this value on the node object. `['config', 'objectName']`
   * writes `node.config.objectName`; `['waitEventConfig', 'eventType']` writes
   * the spec's top-level `node.waitEventConfig.eventType`.
   */
  path: string[];
  /** Human-readable field label (English — repo is English-only). */
  label: string;
  kind: FlowConfigFieldKind;
  placeholder?: string;
  /** Options for `select` fields. */
  options?: Array<{ value: string; label: string }>;
  /** One-line helper hint shown under the control. */
  help?: string;
  /** Spec default, used when resolving `showWhen` against an unset controller. */
  defaultValue?: string;
  /**
   * Conditional visibility: only render this field when the controlling field
   * (referenced by its `id`) currently resolves to one of `equals`. A field is
   * always shown if it already holds a stored value, so existing config is
   * never hidden.
   */
  showWhen?: { field: string; equals: string[] };
  /** Column schema for `objectList` fields (array-of-objects repeater). */
  columns?: FlowConfigColumn[];
}

/** Convenience: a `['config', key]`-rooted field (the common case). */
function cfg(
  key: string,
  label: string,
  kind: FlowConfigFieldKind,
  extra: Partial<FlowConfigField> = {},
): FlowConfigField {
  return { id: key, path: ['config', key], label, kind, ...extra };
}

/** Convenience: a top-level node field at `[block, key]` (spec-structured). */
function at(
  block: string,
  key: string,
  label: string,
  kind: FlowConfigFieldKind,
  extra: Partial<FlowConfigField> = {},
): FlowConfigField {
  return { id: `${block}.${key}`, path: [block, key], label, kind, ...extra };
}

/** Reusable HTTP method options. */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => ({ value: m, label: m }));

/**
 * Config groups keyed by the spec `FlowNodeAction` type. CRUD/script/http
 * fields live under `config`; wait/connector/boundary use the spec's
 * top-level structured blocks.
 */
const FLOW_NODE_CONFIG: Record<string, FlowConfigField[]> = {
  // Trigger — the start node IS the flow trigger (spec: `'start' // Trigger`).
  // The trigger CATEGORY is flow-level (`flow.type`); the start node's `config`
  // carries the trigger PARAMETERS. Keys match real production metadata:
  // record-change starts use objectName + criteria; scheduled starts use a cron
  // `schedule`. All optional and shown together (no category gating) so every
  // real start node renders without falling back to JSON.
  start: [
    cfg('triggerType', 'Trigger', 'select', {
      help: 'When this flow starts. Record triggers fire on data changes; schedule triggers fire on a cron.',
      options: [
        { value: 'record-after-create', label: 'Record created' },
        { value: 'record-after-update', label: 'Record updated' },
        { value: 'record-before-update', label: 'Record before update' },
        { value: 'record-after-delete', label: 'Record deleted' },
        { value: 'record-change', label: 'Record changed (any)' },
        { value: 'schedule', label: 'Schedule (cron)' },
        { value: 'manual', label: 'Manual / autolaunched' },
        { value: 'webhook', label: 'Webhook / API' },
        { value: 'event', label: 'Platform event' },
      ],
    }),
    cfg('objectName', 'Object', 'text', {
      placeholder: 'crm_lead',
      help: 'Target object for record / scheduled-scan triggers.',
    }),
    cfg('condition', 'Entry condition', 'expression', {
      placeholder: 'status == "qualifying" && previous.status != "qualifying"',
      help: 'CEL predicate — the flow runs only when this is true. Leave empty to run on every event.',
    }),
    cfg('cron', 'Cron schedule', 'text', {
      placeholder: '0 7 * * *',
      help: 'Cron expression for scheduled triggers.',
      showWhen: { field: 'triggerType', equals: ['schedule'] },
    }),
    // Legacy keys — rendered only when present so older metadata never falls
    // back to raw JSON. Prefer `condition` / `cron` above for new flows.
    cfg('criteria', 'Entry condition (legacy)', 'expression', {
      placeholder: 'status == "active"',
      help: 'Legacy key — prefer "Entry condition" (condition).',
      showWhen: { field: '__legacy__', equals: [] },
    }),
    cfg('schedule', 'Cron schedule (legacy)', 'text', {
      placeholder: '0 9 * * *',
      help: 'Legacy key — prefer "Cron schedule" (cron).',
      showWhen: { field: '__legacy__', equals: [] },
    }),
  ],
  end: [
    cfg('outcome', 'Outcome', 'text', { placeholder: 'success · failure' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'result' }),
  ],
  decision: [
    cfg('conditions', 'Branches', 'objectList', {
      help: 'Each branch has a label and a CEL expression (spec decision shape). A branch whose expression is "true" is the default/else path.',
      columns: [
        { key: 'label', label: 'Label', kind: 'text', placeholder: 'Has deals' },
        { key: 'expression', label: 'Expression', kind: 'expression', placeholder: 'expiring_deals.length > 0' },
      ],
    }),
    cfg('condition', 'Condition (single)', 'expression', {
      placeholder: 'amount > 10000',
      help: 'Legacy single-branch condition (CEL). Prefer Branches above; per-edge conditions also live on the outgoing edges.',
      showWhen: { field: '__legacy__', equals: [] },
    }),
  ],
  assignment: [
    cfg('assignments', 'Assignments', 'keyValue', {
      help: 'Set variables: each key is a variable, each value an expression or literal.',
    }),
  ],
  loop: [
    cfg('collection', 'Collection', 'expression', { placeholder: '{leadList}', help: 'Expression resolving to the items to iterate.' }),
    cfg('iteratorVariable', 'Item variable', 'text', { placeholder: 'currentItem' }),
  ],
  create_record: [
    cfg('objectName', 'Object', 'text', { placeholder: 'contract' }),
    cfg('fields', 'Field values', 'keyValue', { help: 'Field values to write on the new record.' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'newRecord' }),
  ],
  update_record: [
    cfg('objectName', 'Object', 'text', { placeholder: 'contract' }),
    cfg('filter', 'Filter', 'keyValue', { help: 'Field/value pairs identifying the record(s) to update (e.g. id → {recordId}).' }),
    cfg('fields', 'Field values', 'keyValue', { help: 'Field values to write.' }),
  ],
  delete_record: [
    cfg('objectName', 'Object', 'text', { placeholder: 'contract' }),
    cfg('filter', 'Filter', 'keyValue', { help: 'Field/value pairs identifying the record(s) to delete.' }),
  ],
  get_record: [
    cfg('objectName', 'Object', 'text', { placeholder: 'contract' }),
    cfg('filter', 'Filter', 'keyValue', { help: 'Field/value pairs to match (e.g. status → active). Operator values like {"$ne": null} are preserved.' }),
    cfg('limit', 'Limit', 'number', { placeholder: '100' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'records' }),
  ],
  http_request: [
    cfg('method', 'Method', 'select', { options: HTTP_METHODS, defaultValue: 'GET' }),
    cfg('url', 'URL', 'text', { placeholder: 'https://api.example.com/v1/contracts' }),
    cfg('headers', 'Headers', 'keyValue', { help: 'Request headers (e.g. Authorization, Content-Type).' }),
    cfg('body', 'Body', 'textarea', { placeholder: '{ "key": "value" }', help: 'Request payload (JSON or expression).' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'response' }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '30000' },
  ],
  // Script — overloaded in real metadata. Two observed shapes, discriminated by
  // `actionType`: notification (actionType: email/sms/... → template/recipients/
  // variables) and code (no actionType → script/outputVariables). The form adapts
  // on actionType; unknown values still show the code fields so nothing is lost.
  script: [
    cfg('actionType', 'Action type', 'select', {
      options: [
        { value: 'code', label: 'Code' },
        { value: 'email', label: 'Email' },
        { value: 'sms', label: 'SMS' },
        { value: 'notification', label: 'Notification' },
      ],
      defaultValue: 'code',
      help: 'How this step runs. Leave as Code for a raw script.',
    }),
    cfg('template', 'Template', 'text', {
      placeholder: 'case_escalated',
      help: 'Message template id.',
      showWhen: { field: 'actionType', equals: ['email', 'sms', 'notification'] },
    }),
    cfg('recipients', 'Recipients', 'stringList', {
      help: 'One recipient per row (user id, field ref, or address).',
      showWhen: { field: 'actionType', equals: ['email', 'sms', 'notification'] },
    }),
    cfg('variables', 'Template variables', 'keyValue', {
      help: 'Values injected into the template.',
      showWhen: { field: 'actionType', equals: ['email', 'sms', 'notification'] },
    }),
    cfg('script', 'Code', 'textarea', {
      placeholder: 'return { ok: true };',
      help: 'Script body (JS/TS).',
      showWhen: { field: 'actionType', equals: ['code'] },
    }),
    cfg('outputVariables', 'Output variables', 'stringList', {
      help: 'Names of variables this script writes back.',
      showWhen: { field: 'actionType', equals: ['code'] },
    }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '30000' },
  ],
  screen: [
    cfg('fields', 'Fields', 'objectList', {
      help: 'Fields presented on this screen.',
      columns: [
        { key: 'name', label: 'Name', kind: 'text', placeholder: 'discount' },
        { key: 'label', label: 'Label', kind: 'text', placeholder: 'Discount %' },
        { key: 'type', label: 'Type', kind: 'text', placeholder: 'number' },
        { key: 'required', label: 'Required', kind: 'boolean' },
        { key: 'visibleWhen', label: 'Visible when', kind: 'expression', placeholder: 'stage == "review"' },
      ],
    }),
  ],
  wait: [
    at('waitEventConfig', 'eventType', 'Wait for', 'select', {
      options: [
        { value: 'timer', label: 'Timer' },
        { value: 'signal', label: 'Signal' },
        { value: 'webhook', label: 'Webhook' },
        { value: 'manual', label: 'Manual' },
        { value: 'condition', label: 'Condition' },
      ],
      defaultValue: 'timer',
    }),
    at('waitEventConfig', 'timerDuration', 'Duration', 'text', {
      placeholder: 'PT1H · P3D',
      help: 'ISO 8601 duration (e.g. PT1H, P3D).',
      showWhen: { field: 'waitEventConfig.eventType', equals: ['timer'] },
    }),
    at('waitEventConfig', 'signalName', 'Signal name', 'text', {
      placeholder: 'contract.renewed',
      showWhen: { field: 'waitEventConfig.eventType', equals: ['signal', 'webhook'] },
    }),
    at('waitEventConfig', 'timeoutMs', 'Timeout (ms)', 'number', { placeholder: '3600000' }),
    at('waitEventConfig', 'onTimeout', 'On timeout', 'select', {
      options: [
        { value: 'fail', label: 'Fail' },
        { value: 'continue', label: 'Continue' },
      ],
      defaultValue: 'fail',
    }),
  ],
  subflow: [
    cfg('flowName', 'Flow', 'text', { placeholder: 'escalation_flow' }),
    cfg('input', 'Input mapping', 'keyValue', { help: 'Values passed to the subflow\u2019s input variables.' }),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'subResult' }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '60000' },
  ],
  connector_action: [
    at('connectorConfig', 'connectorId', 'Connector', 'text', { placeholder: 'slack · email · salesforce' }),
    at('connectorConfig', 'actionId', 'Action', 'text', { placeholder: 'sendMessage · send' }),
    at('connectorConfig', 'input', 'Input', 'keyValue', { help: 'Mapped inputs for the connector action.' }),
    { id: 'timeoutMs', path: ['timeoutMs'], label: 'Timeout (ms)', kind: 'number', placeholder: '30000' },
  ],
  parallel_gateway: [],
  join_gateway: [],
  boundary_event: [
    at('boundaryConfig', 'attachedToNodeId', 'Attached to', 'text', { placeholder: 'host node id', help: 'Host node this boundary event monitors.' }),
    at('boundaryConfig', 'eventType', 'Event type', 'select', {
      options: [
        { value: 'error', label: 'Error' },
        { value: 'timer', label: 'Timer' },
        { value: 'signal', label: 'Signal' },
        { value: 'cancel', label: 'Cancel' },
      ],
      defaultValue: 'error',
    }),
    at('boundaryConfig', 'interrupting', 'Interrupting', 'boolean', { help: 'Cancel the host activity when this event fires.' }),
    at('boundaryConfig', 'errorCode', 'Error code', 'text', {
      placeholder: 'TIMEOUT (empty = all)',
      showWhen: { field: 'boundaryConfig.eventType', equals: ['error'] },
    }),
    at('boundaryConfig', 'timerDuration', 'Duration', 'text', {
      placeholder: 'PT1H',
      showWhen: { field: 'boundaryConfig.eventType', equals: ['timer'] },
    }),
    at('boundaryConfig', 'signalName', 'Signal name', 'text', {
      placeholder: 'contract.cancelled',
      showWhen: { field: 'boundaryConfig.eventType', equals: ['signal'] },
    }),
  ],

  /**
   * Legacy generic "action" group — retained for flows authored before the
   * spec node types were adopted. Never auto-migrated to a spec type (the old
   * `action` could mean create/update/query/email/webhook); authors re-pick a
   * precise type explicitly.
   */
  legacy_action: [
    cfg('action', 'Action', 'text', { placeholder: 'sendEmail · createTask · update · query' }),
    cfg('objectName', 'Object', 'text', { placeholder: 'contract' }),
    cfg('recordId', 'Record', 'expression', { placeholder: 'record.id' }),
    cfg('params', 'Parameters', 'keyValue', { help: 'Action inputs. Values auto-typed: 3 \u2192 number, true \u2192 boolean.' }),
    cfg('fields', 'Field values', 'keyValue' ),
    cfg('outputVariable', 'Output variable', 'text', { placeholder: 'result' }),
  ],
};

/**
 * Maps legacy / alias designer node types onto a spec config group. The spec
 * `FlowNodeAction` types resolve to themselves; older designer types resolve to
 * the closest spec group. Legacy generic `action` resolves to `legacy_action`
 * (kept deliberately distinct — never silently rewritten to a CRUD type).
 */
const TYPE_ALIASES: Record<string, string> = {
  action: 'legacy_action',
  branch: 'decision',
  gateway: 'decision',
  condition: 'decision',
  timer: 'wait',
  delay: 'wait',
  flow: 'subflow',
  invoke: 'subflow',
  task: 'legacy_action',
  user_task: 'screen',
  service_task: 'connector_action',
  script_task: 'script',
  notification: 'connector_action',
  approval: 'screen',
  signal: 'boundary_event',
  webhook: 'connector_action',
  for_each: 'loop',
  parallel: 'parallel_gateway',
};

/** Resolve the config fields for a node type (alias-aware). */
export function fieldsForNodeType(type?: string): FlowConfigField[] {
  if (!type) return [];
  const canonical = TYPE_ALIASES[type] ?? type;
  return FLOW_NODE_CONFIG[canonical] ?? [];
}

/** Read the current value at a field's node path. */
export function getFieldValue(node: Record<string, unknown> | null | undefined, field: FlowConfigField): unknown {
  let cur: unknown = node;
  for (const seg of field.path) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur = (cur as Record<string, unknown>)[seg];
    else return undefined;
  }
  return cur;
}

/**
 * The `config` key this field owns, or `undefined` for fields stored outside
 * `config` (spec-structured blocks, top-level `timeoutMs`). Used by the
 * inspector to compute "extra" config keys for the optional Advanced block —
 * only config-rooted fields suppress an Advanced key.
 */
export function configKeyOf(field: FlowConfigField): string | undefined {
  return field.path.length === 2 && field.path[0] === 'config' ? field.path[1] : undefined;
}

/**
 * Whether a field should render. Conditional fields show when their controller
 * (by `id`) resolves — via stored value, else spec `defaultValue` — to one of
 * `equals`, OR when the field already holds a stored value (so existing config
 * is never hidden).
 */
export function isFieldVisible(
  field: FlowConfigField,
  node: Record<string, unknown> | null | undefined,
  fields: FlowConfigField[],
): boolean {
  if (!field.showWhen) return true;
  const own = getFieldValue(node, field);
  if (own !== undefined && own !== null && own !== '') return true;
  const controller = fields.find((f) => f.id === field.showWhen!.field);
  if (!controller) return false;
  const raw = getFieldValue(node, controller);
  const value = raw === undefined || raw === null || raw === '' ? controller.defaultValue : raw;
  return typeof value === 'string' && field.showWhen.equals.includes(value);
}

/** Node types offered in the inspector's type picker (spec `FlowNodeAction`). */
export const FLOW_NODE_TYPE_OPTIONS = [
  'start',
  'create_record',
  'update_record',
  'delete_record',
  'get_record',
  'decision',
  'assignment',
  'loop',
  'http_request',
  'script',
  'screen',
  'wait',
  'subflow',
  'connector_action',
  'parallel_gateway',
  'join_gateway',
  'boundary_event',
  'end',
] as const;
