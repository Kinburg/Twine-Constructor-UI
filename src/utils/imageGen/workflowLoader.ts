import type { ImageGenProvider } from '../../types';
import { fsApi, joinPath } from '../../lib/fsApi';

export const EXAMPLES_PREFIX = 'examples:';

export async function collectWorkflowFiles(absDir: string, relDir: string): Promise<string[]> {
  const entries = await fsApi.listDir(absDir);
  const files: string[] = [];
  for (const entry of entries) {
    const absPath = joinPath(absDir, entry.name);
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDir) {
      files.push(...await collectWorkflowFiles(absPath, relPath));
    } else if (entry.name.toLowerCase().endsWith('.json')) {
      files.push(relPath);
    }
  }
  return files;
}

export async function loadExampleWorkflows(): Promise<string[]> {
  const dir = await fsApi.getExampleWorkflowsDir();
  if (!await fsApi.exists(dir)) return [];
  const list = await collectWorkflowFiles(dir, '');
  return list.sort((a, b) => a.localeCompare(b)).map(f => EXAMPLES_PREFIX + f);
}

export async function loadComfyWorkflow(
  provider: ImageGenProvider,
  workflowFile: string | undefined,
  comfyUiWorkflowsDir: string,
  projectDir: string,
): Promise<Record<string, any>> {
  if (provider !== 'comfyui' || !workflowFile) return {};

  let basePath: string;
  let relFile: string;

  if (workflowFile.startsWith(EXAMPLES_PREFIX)) {
    basePath = await fsApi.getExampleWorkflowsDir();
    relFile = workflowFile.slice(EXAMPLES_PREFIX.length);
  } else {
    const useGlobal = comfyUiWorkflowsDir.trim() !== '';
    basePath = useGlobal ? comfyUiWorkflowsDir.trim() : projectDir;
    relFile = workflowFile;
  }

  return JSON.parse(await fsApi.readFile(joinPath(basePath, relFile)));
}
