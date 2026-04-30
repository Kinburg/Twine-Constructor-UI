import { useEffect, useRef } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useEditorPrefsStore } from '../store/editorPrefsStore';
import { fsApi, joinPath, safeName } from '../lib/fsApi';

export function useAutosave() {
  const autosave         = useEditorPrefsStore(s => s.autosave);
  const autosaveInterval = useEditorPrefsStore(s => s.autosaveInterval);

  // Keep a ref to the latest store state so the interval closure never goes stale
  const stateRef = useRef(useProjectStore.getState());
  useEffect(() => useProjectStore.subscribe(s => { stateRef.current = s; }), []);

  useEffect(() => {
    if (!autosave) return;

    const ms = autosaveInterval * 60 * 1000;
    const id = setInterval(async () => {
      const { project, projectDir } = stateRef.current;
      if (!projectDir) return;
      try {
        await fsApi.mkdir(joinPath(projectDir, 'release', 'assets'));
        const fileName = `${safeName(project.title)}.purl`;
        await fsApi.writeFile(joinPath(projectDir, fileName), JSON.stringify(project, null, 2));
      } catch (e) {
        console.error('[autosave] failed:', e);
      }
    }, ms);

    return () => clearInterval(id);
  }, [autosave, autosaveInterval]);
}
