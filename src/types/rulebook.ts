// TypeScript types for Ansible Rulebook schema

export interface Rulebook {
  rulesets: Ruleset[];
}

export interface Ruleset {
  name: string;
  hosts: string;
  sources: Source[];
  rules: Rule[];
  default_events_ttl?: string;
  gather_facts?: boolean;
  match_multiple_rules?: boolean;
  execution_strategy?: 'parallel' | 'sequential';
}

export interface Source {
  name?: string;
  filters?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface Rule {
  name: string;
  condition: Condition;
  actions?: Action[];
  action?: Action;
  enabled?: boolean;
  throttle?: Throttle;
}

export type Condition =
  | string
  | boolean
  | AllCondition
  | AnyCondition
  | NotAllCondition;

export interface AllCondition {
  all: string[];
  timeout?: string;
}

export interface AnyCondition {
  any: string[];
}

export interface NotAllCondition {
  not_all: string[];
  timeout: string;
}

export interface Throttle {
  once_within?: string;
  once_after?: string;
  accumulate_within?: string;
  threshold?: number;
  group_by_attributes: string[];
}

export type Action =
  | RunPlaybookAction
  | RunModuleAction
  | RunJobTemplateAction
  | RunWorkflowTemplateAction
  | PostEventAction
  | SetFactAction
  | RetractFactAction
  | PrintEventAction
  | DebugAction
  | NoneAction
  | ShutdownAction;

export interface RunPlaybookAction {
  run_playbook: {
    name: string;
    copy_files?: boolean;
    post_events?: boolean;
    set_facts?: boolean;
    ruleset?: string;
    verbosity?: number;
    var_root?: string | Record<string, unknown>;
    json_mode?: boolean;
    retry?: boolean;
    retries?: number;
    delay?: number;
    extra_vars?: Record<string, unknown>;
    lock?: string;
  };
}

export interface RunModuleAction {
  run_module: {
    name: string;
    post_events?: boolean;
    set_facts?: boolean;
    verbosity?: number;
    var_root?: string | Record<string, unknown>;
    json_mode?: boolean;
    retry?: boolean;
    retries?: number;
    delay?: number;
    module_args?: Record<string, unknown> | string;
    extra_vars?: Record<string, unknown>;
    lock?: string;
  };
}

export interface RunJobTemplateAction {
  run_job_template: {
    name: string;
    organization: string;
    job_args?: Record<string, unknown>;
    post_events?: boolean;
    set_facts?: boolean;
    ruleset?: string;
    var_root?: string;
    retry?: boolean;
    retries?: number;
    delay?: number;
    include_events?: boolean;
    lock?: string;
    labels?: string[];
  };
}

export interface RunWorkflowTemplateAction {
  run_workflow_template: {
    name: string;
    organization: string;
    job_args?: Record<string, unknown>;
    post_events?: boolean;
    set_facts?: boolean;
    ruleset?: string;
    var_root?: string;
    retry?: boolean;
    retries?: number;
    delay?: number;
    include_events?: boolean;
    lock?: string;
    labels?: string[];
  };
}

export interface PostEventAction {
  post_event: {
    ruleset?: string;
    event: Record<string, unknown>;
  };
}

export interface SetFactAction {
  set_fact: {
    ruleset?: string;
    fact: Record<string, unknown>;
  };
}

export interface RetractFactAction {
  retract_fact: {
    ruleset?: string;
    fact: Record<string, unknown>;
    partial?: boolean;
  };
}

export interface PrintEventAction {
  print_event: {
    var_root?: string | Record<string, unknown>;
    pretty?: boolean;
  } | null;
}

export interface DebugAction {
  debug: {
    msg?: string | string[];
    var?: string;
  } | null;
}

export interface NoneAction {
  none: Record<string, unknown> | null;
}

export interface ShutdownAction {
  shutdown: {
    delay?: number;
    message?: string;
    kind?: 'graceful' | 'now';
  } | null;
}

// Helper function to get action type
export function getActionType(action: Action): string {
  if ('run_playbook' in action) return 'run_playbook';
  if ('run_module' in action) return 'run_module';
  if ('run_job_template' in action) return 'run_job_template';
  if ('run_workflow_template' in action) return 'run_workflow_template';
  if ('post_event' in action) return 'post_event';
  if ('set_fact' in action) return 'set_fact';
  if ('retract_fact' in action) return 'retract_fact';
  if ('print_event' in action) return 'print_event';
  if ('debug' in action) return 'debug';
  if ('none' in action) return 'none';
  if ('shutdown' in action) return 'shutdown';
  return 'unknown';
}

// Helper function to get condition type
export function getConditionType(condition: Condition): string {
  if (typeof condition === 'string') return 'string';
  if (typeof condition === 'boolean') return 'boolean';
  if (typeof condition === 'object') {
    if ('all' in condition) return 'all';
    if ('any' in condition) return 'any';
    if ('not_all' in condition) return 'not_all';
  }
  return 'unknown';
}

// Helper function to get actions array (handles both 'action' and 'actions')
export function getActionsArray(rule: Rule): Action[] {
  if (rule.actions && rule.actions.length > 0) {
    return rule.actions;
  }
  if (rule.action) {
    return [rule.action];
  }
  return [];
}
