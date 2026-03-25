import type { Variable, VariableType } from '../../types';

export const TYPE_DEFAULTS: Record<VariableType, string> = {
  number: '0', string: '', boolean: 'false', array: '[]',
};

export const TYPE_COLOR: Record<VariableType, string> = {
  number: 'text-sky-400', string: 'text-emerald-400', boolean: 'text-amber-400', array: 'text-violet-400',
};

/** Callbacks for tree mutations — allows backing by store or local state */
export interface TreeActions {
  onAddVariable: (parentId: string | null, data: { name: string; varType: VariableType; defaultValue: string; description: string }) => void;
  onAddGroup: (parentId: string | null, name: string) => void;
  onUpdateVariable: (id: string, patch: Partial<Variable>) => void;
  onDeleteNode: (id: string) => void;
}
