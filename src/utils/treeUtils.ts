import type { Variable, VariableTreeNode, Asset, AssetTreeNode } from '../types';

export function flattenVariables(nodes: VariableTreeNode[]): Variable[] {
  const result: Variable[] = [];
  for (const n of nodes) {
    if (n.kind === 'variable') result.push(n);
    else result.push(...flattenVariables(n.children));
  }
  return result;
}

export function flattenAssets(nodes: AssetTreeNode[]): Asset[] {
  const result: Asset[] = [];
  for (const n of nodes) {
    if (n.kind === 'asset') result.push(n);
    else result.push(...flattenAssets(n.children));
  }
  return result;
}
