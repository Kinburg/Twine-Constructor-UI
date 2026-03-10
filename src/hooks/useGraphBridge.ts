import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { buildGraphData } from '../utils/buildGraphData';

/**
 * Two-way bridge between the main window and the scene graph window.
 *
 * • Pushes updated graph data whenever the project or active scene changes.
 * • Listens for position updates from the graph window and saves them to the store.
 * • Listens for navigate requests from the graph window and switches the active scene.
 *
 * No-op when running outside Electron.
 */
export function useGraphBridge(): void {
  const project             = useProjectStore(s => s.project);
  const activeSceneId       = useProjectStore(s => s.activeSceneId);
  const updateSceneGraphPosition = useProjectStore(s => s.updateSceneGraphPosition);
  const setActiveScene      = useProjectStore(s => s.setActiveScene);

  // ── Push data on every relevant project change ───────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.updateGraph) return;
    api.updateGraph(buildGraphData(project, activeSceneId));
  }, [project, activeSceneId]);

  // ── Handle incoming position updates (graph → main) ──────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onGraphMove) return;
    api.onGraphMove((sceneId, x, y) => {
      updateSceneGraphPosition(sceneId, x, y);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle incoming navigate requests (graph → main) ─────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onGraphNavigate) return;
    api.onGraphNavigate((sceneId) => {
      setActiveScene(sceneId);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
