import { createContext, useContext, type ReactNode } from 'react';
import type { VariableTreeNode } from '../../types';
import { useProjectStore } from '../../store/projectStore';

/**
 * Scope override for variable-picker-enabled block editors.
 *
 * When set (via VariableScopeProvider), block editors rendered inside should
 * treat the provided tree as the *entire* set of available variables instead
 * of the project-wide variableNodes. Used by the plugin body editor so blocks
 * can only target plugin parameters, not global state.
 */
const VariableScopeContext = createContext<VariableTreeNode[] | null>(null);

export function VariableScopeProvider({
  nodes,
  children,
}: {
  nodes: VariableTreeNode[];
  children: ReactNode;
}) {
  return (
    <VariableScopeContext.Provider value={nodes}>
      {children}
    </VariableScopeContext.Provider>
  );
}

/**
 * Returns the effective variable tree for the current editor location:
 * the scope override if set, otherwise the project-wide variableNodes.
 */
export function useVariableNodes(): VariableTreeNode[] {
  const scope = useContext(VariableScopeContext);
  const projectNodes = useProjectStore((s) => s.project.variableNodes);
  return scope ?? projectNodes;
}

/** True when editing a block inside a scoped container (e.g. plugin body). */
export function useIsScopedVariables(): boolean {
  return useContext(VariableScopeContext) !== null;
}
