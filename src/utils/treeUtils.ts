import type { Variable, VariableType, VariableTreeNode, VariableGroup, Asset, AssetTreeNode } from '../types';

export function flattenVariables(nodes: VariableTreeNode[]): Variable[] {
  const result: Variable[] = [];
  for (const n of nodes) {
    if (n.kind === 'variable') result.push(n);
    else result.push(...flattenVariables(n.children));
  }
  return result;
}

/** Returns the dot-path for a variable by its id, e.g. "chars.developer.name" or "gold" */
export function getVariablePath(id: string, nodes: VariableTreeNode[], prefix: string[] = []): string {
  for (const n of nodes) {
    if (n.kind === 'variable' && n.id === id) return [...prefix, n.name].join('.');
    if (n.kind === 'group') {
      const found = getVariablePath(id, n.children, [...prefix, n.name]);
      if (found) return found;
    }
  }
  return '';
}

/** Returns the dot-path for ANY node (variable or group) by its id.
 *  Used when groups are selectable (object-kind params). */
export function getNodePath(id: string, nodes: VariableTreeNode[], prefix: string[] = []): string {
  for (const n of nodes) {
    const myPath = [...prefix, n.name].join('.');
    if (n.id === id) return myPath;
    if (n.kind === 'group') {
      const found = getNodePath(id, n.children, [...prefix, n.name]);
      if (found) return found;
    }
  }
  return '';
}

/** Flattens all variables with their computed dot-paths */
export function flattenVariablesWithPaths(
  nodes: VariableTreeNode[],
  prefix: string[] = []
): Array<Variable & { path: string }> {
  const result: Array<Variable & { path: string }> = [];
  for (const n of nodes) {
    if (n.kind === 'variable') {
      result.push({ ...n, path: [...prefix, n.name].join('.') });
    }
    if (n.kind === 'group') {
      result.push(...flattenVariablesWithPaths(n.children, [...prefix, n.name]));
    }
  }
  return result;
}

/** Checks if a group (or its nested sub-groups) contains at least one variable leaf */
export function hasLeafVariables(group: VariableGroup, filterType?: VariableType): boolean {
  return group.children.some(n =>
    (n.kind === 'variable' && (!filterType || n.varType === filterType)) ||
    (n.kind === 'group' && hasLeafVariables(n, filterType))
  );
}

/** Checks if a name collides with any sibling node (variable or group) */
export function hasSiblingNameConflict(
  name: string,
  siblings: VariableTreeNode[],
  excludeId?: string
): boolean {
  return siblings.some(n => n.name === name && n.id !== excludeId);
}

export function flattenAssets(nodes: AssetTreeNode[]): Asset[] {
  const result: Asset[] = [];
  for (const n of nodes) {
    if (n.kind === 'asset') result.push(n);
    else result.push(...flattenAssets(n.children));
  }
  return result;
}
