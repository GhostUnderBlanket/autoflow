import { TriggerNode }   from './TriggerNode';
import { RestNode }      from './RestNode';
import { ScriptNode }    from './ScriptNode';
import { ConditionNode } from './ConditionNode';

export const nodeTypes = {
  trigger:   TriggerNode,
  rest:      RestNode,
  script:    ScriptNode,
  condition: ConditionNode,
} as const;
