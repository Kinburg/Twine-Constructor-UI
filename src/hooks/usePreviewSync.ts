import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { blockToSC } from '../utils/exportToTwee';
import { flattenVariables } from '../utils/treeUtils';

/**
 * Pushes the generated twee code for the currently active scene to the
 * preview window (if open) every time the project or active scene changes.
 *
 * No-op when running outside Electron (window.electronAPI unavailable).
 */
export function usePreviewSync(): void {
  const project       = useProjectStore(s => s.project);
  const activeSceneId = useProjectStore(s => s.activeSceneId);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.updatePreview) return;

    const scene = project.scenes.find(s => s.id === activeSceneId);
    if (!scene) {
      api.updatePreview('(no scene selected)');
      return;
    }

    const vars = flattenVariables(project.variableNodes);
    const tags = scene.tags.length > 0 ? ` [${scene.tags.join(' ')}]` : '';
    const body = scene.blocks
      .map(b => blockToSC(b, project.characters, vars, project.variableNodes))
      .filter(Boolean)
      .join('\n');

    api.updatePreview(`::${scene.name}${tags}\n${body || '(empty scene)'}`);
  }, [project, activeSceneId]);
}
