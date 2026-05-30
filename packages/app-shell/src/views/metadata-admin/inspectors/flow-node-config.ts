// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * flow-node-config — declarative config-field schema per flow node type.
 *
 * The flow node inspector renders proper form controls (instead of a raw
 * JSON blob) by looking up the field descriptors for a node's type here.
 * Each field edits a scalar key on `node.config`. Any config keys *not*
 * covered by a descriptor are surfaced in the inspector's "Advanced (JSON)"
 * section so authors are never locked out of bespoke configuration.
 *
 * Field kinds: scalar (text / expression / number / boolean / select) plus
 * `keyValue` for flat object maps (e.g. action params, subflow input). Deeply
 * nested / array values still fall back to the optional Advanced JSON block.
 */

export type FlowConfigFieldKind =
  | 'text'
  | 'expression'
  | 'number'
  | 'boolean'
  | 'select'
  | 'keyValue';

export interface FlowConfigField {
  /** Key written under `node.config`. */
  key: string;
  /** Human-readable field label (English — repo is English-only). */
  label: string;
  kind: FlowConfigFieldKind;
  placeholder?: string;
  /** Options for `select` fields. */
  options?: Array<{ value: string; label: string }>;
  /** One-line helper hint shown under the control. */
  help?: string;
  /**
   * Conditional visibility: only render this field when the controlling field's
   * current value is one of `equals`. A field is always shown if it already has
   * a stored value, so existing config is never hidden.
   */
  showWhen?: { field: string; equals: string[] };
}

/** Canonical config groups keyed by a normalized node "kind". */
const FLOW_NODE_CONFIG: Record<string, FlowConfigField[]> = {
  start: [
    {
      key: 'triggerType',
      label: 'Trigger',
      kind: 'select',
      options: [
        { value: 'manual', label: 'Manual' },
        { value: 'scheduled', label: 'Scheduled' },
        { value: 'record_create', label: 'Record created' },
        { value: 'record_update', label: 'Record updated' },
        { value: 'event', label: 'Platform event' },
        { value: 'webhook', label: 'Webhook' },
      ],
    },
    { key: 'schedule', label: 'Schedule', kind: 'text', placeholder: '0 9 * * *', help: 'Cron or interval (e.g. 0 9 * * *, every 1h).', showWhen: { field: 'triggerType', equals: ['scheduled'] } },
    { key: 'objectName', label: 'Object', kind: 'text', placeholder: 'contract', showWhen: { field: 'triggerType', equals: ['record_create', 'record_update'] } },
    { key: 'eventName', label: 'Event', kind: 'text', placeholder: 'contract.signed', showWhen: { field: 'triggerType', equals: ['event'] } },
    { key: 'webhookPath', label: 'Webhook path', kind: 'text', placeholder: '/hooks/renewal', showWhen: { field: 'triggerType', equals: ['webhook'] } },
  ],
  action: [
    { key: 'action', label: 'Action', kind: 'text', placeholder: 'sendEmail · createTask · update · query' },
    { key: 'objectName', label: 'Object', kind: 'text', placeholder: 'contract' },
    { key: 'recordId', label: 'Record', kind: 'expression', placeholder: 'record.id', help: 'Record reference for update / delete / get actions.' },
    { key: 'params', label: 'Parameters', kind: 'keyValue', help: 'Action inputs (e.g. to, template). Values auto-typed: 3 → number, true → boolean.' },
    { key: 'fields', label: 'Field values', kind: 'keyValue', help: 'Field values to write for create / update actions.' },
    { key: 'outputVariable', label: 'Output variable', kind: 'text', placeholder: 'result' },
  ],
  decision: [
    { key: 'expression', label: 'Condition', kind: 'expression', placeholder: 'daysToExpiry <= daysBefore', help: 'Default branch condition. Per-branch conditions live on outgoing edges.' },
  ],
  wait: [
    {
      key: 'waitType',
      label: 'Wait for',
      kind: 'select',
      options: [
        { value: 'duration', label: 'Duration' },
        { value: 'until', label: 'Until date' },
        { value: 'condition', label: 'Condition' },
        { value: 'signal', label: 'Signal' },
      ],
    },
    { key: 'duration', label: 'Duration', kind: 'text', placeholder: '3d · PT1H', help: 'ISO 8601 or shorthand (e.g. 3d, 2h, 30m).', showWhen: { field: 'waitType', equals: ['duration'] } },
    { key: 'until', label: 'Until', kind: 'text', placeholder: 'contract.endDate', showWhen: { field: 'waitType', equals: ['until'] } },
    { key: 'condition', label: 'Condition', kind: 'expression', placeholder: 'record.status == "ready"', showWhen: { field: 'waitType', equals: ['condition'] } },
    { key: 'signalName', label: 'Signal name', kind: 'text', placeholder: 'contract.renewed', showWhen: { field: 'waitType', equals: ['signal'] } },
  ],
  subflow: [
    { key: 'flowName', label: 'Flow', kind: 'text', placeholder: 'escalation_flow' },
    { key: 'input', label: 'Input mapping', kind: 'keyValue', help: 'Values passed to the subflow\u2019s input variables.' },
    { key: 'outputVariable', label: 'Output variable', kind: 'text', placeholder: 'subResult' },
  ],
  signal: [
    { key: 'signalName', label: 'Signal name', kind: 'text', placeholder: 'contract.renewed' },
    {
      key: 'eventType',
      label: 'Event type',
      kind: 'select',
      options: [
        { value: 'signal', label: 'Signal' },
        { value: 'webhook', label: 'Webhook' },
        { value: 'timer', label: 'Timer' },
        { value: 'manual', label: 'Manual' },
        { value: 'condition', label: 'Condition' },
      ],
    },
    { key: 'timer', label: 'Timer', kind: 'text', placeholder: 'PT1H · 0 9 * * *', help: 'ISO 8601 duration or cron expression.', showWhen: { field: 'eventType', equals: ['timer'] } },
    { key: 'webhookPath', label: 'Webhook path', kind: 'text', placeholder: '/hooks/contract', showWhen: { field: 'eventType', equals: ['webhook'] } },
    { key: 'condition', label: 'Condition', kind: 'expression', placeholder: 'record.status == "active"', showWhen: { field: 'eventType', equals: ['condition'] } },
  ],
  loop: [
    { key: 'collection', label: 'Collection', kind: 'expression', placeholder: 'contracts', help: 'Expression resolving to the items to iterate.' },
    { key: 'itemVariable', label: 'Item variable', kind: 'text', placeholder: 'item' },
    { key: 'maxIterations', label: 'Max iterations', kind: 'number', placeholder: '1000' },
  ],
  parallel: [],
  end: [
    { key: 'outcome', label: 'Outcome', kind: 'text', placeholder: 'success · failure' },
    { key: 'outputVariable', label: 'Output variable', kind: 'text', placeholder: 'result' },
  ],
};

/** Maps concrete node types onto a canonical config group. */
const TYPE_ALIASES: Record<string, string> = {
  branch: 'decision',
  gateway: 'decision',
  condition: 'decision',
  timer: 'wait',
  delay: 'wait',
  flow: 'subflow',
  invoke: 'subflow',
  task: 'action',
  user_task: 'action',
  service_task: 'action',
  script_task: 'action',
  notification: 'action',
  approval: 'action',
  webhook: 'signal',
  boundary_event: 'signal',
  for_each: 'loop',
  parallel_gateway: 'parallel',
  join_gateway: 'parallel',
};

/** Resolve the scalar config fields for a node type (alias-aware). */
export function fieldsForNodeType(type?: string): FlowConfigField[] {
  if (!type) return [];
  const canonical = TYPE_ALIASES[type] ?? type;
  return FLOW_NODE_CONFIG[canonical] ?? [];
}

/**
 * Whether a field should render for the given config. Conditional fields are
 * shown when their controlling value matches, OR when the field already holds a
 * value (so existing config is never hidden).
 */
export function isFieldVisible(field: FlowConfigField, config: Record<string, unknown>): boolean {
  if (!field.showWhen) return true;
  const current = config[field.key];
  if (current !== undefined && current !== null && current !== '') return true;
  const controller = config[field.showWhen.field];
  return typeof controller === 'string' && field.showWhen.equals.includes(controller);
}

/** Node types offered in the inspector's type picker. */
export const FLOW_NODE_TYPE_OPTIONS = [
  'start',
  'action',
  'task',
  'decision',
  'wait',
  'subflow',
  'signal',
  'loop',
  'parallel',
  'end',
] as const;
