import { TriggerNode }    from './TriggerNode';
import { RestNode }       from './RestNode';
import { ScriptNode }     from './ScriptNode';
import { ConditionNode }  from './ConditionNode';
import { FileNode }       from './FileNode';
import { OpenUrlNode }    from './OpenUrlNode';
import { LoopNode }       from './LoopNode';
import { LaunchAppNode }  from './LaunchAppNode';
import { GroupNode }      from './GroupNode';
import { DelayNode }      from './DelayNode';
import { SubflowNode }    from './SubflowNode';

export const nodeTypes = {
  trigger:   TriggerNode,
  rest:      RestNode,
  script:    ScriptNode,
  condition: ConditionNode,
  file:      FileNode,
  openurl:   OpenUrlNode,
  loop:      LoopNode,
  launchapp: LaunchAppNode,
  group:     GroupNode,
  delay:     DelayNode,
  subflow:   SubflowNode,
} as const;
