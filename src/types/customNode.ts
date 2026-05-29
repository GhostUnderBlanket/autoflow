export type CustomFieldType = 'text' | 'textarea' | 'number' | 'toggle' | 'select';

export interface CustomNodeField {
  name:         string;
  label:        string;
  type:         CustomFieldType;
  placeholder?: string;
  default?:     string;
  options?:     string[];
}

export interface ScriptExecutor {
  type:     'script';
  shell:    'cmd' | 'powershell' | 'bash';
  /** Template string. Use ${field.NAME} for field values plus any standard ${prev}/${var:NAME} tokens. */
  template: string;
}

export interface JsExecutor {
  type: 'js';
  /** Complete async arrow-function expression, e.g. "async ({ fields, prev, log }) => { ... }". */
  fn:   string;
}

export type CustomExecutor = ScriptExecutor | JsExecutor;

export interface CustomNodeDef {
  id:           string;
  label:        string;
  color:        string;
  description?: string;
  version?:     string;
  fields:       CustomNodeField[];
  executor:     CustomExecutor;
}
