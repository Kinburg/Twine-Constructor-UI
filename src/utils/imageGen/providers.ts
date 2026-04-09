import type { ImageGenProvider } from '../../types';

export interface ImageGenerateParams {
  baseUrl: string;
  workflow: Record<string, any>;
  prompt: string;
  negativePrompt?: string;
}

export interface ImageGenerateResult {
  imageUrl: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function withPromptInjected(
  workflow: Record<string, any>,
  prompt: string,
  negativePrompt?: string,
): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(workflow));

  for (const node of Object.values(clone as Record<string, any>)) {
    if (!node || typeof node !== 'object' || typeof node.inputs !== 'object') continue;
    const inputs = node.inputs as Record<string, any>;

    if (typeof inputs.text === 'string') {
      const cls = String(node.class_type ?? '').toLowerCase();
      if (cls.includes('negative')) {
        inputs.text = negativePrompt ?? inputs.text;
      } else {
        inputs.text = prompt;
      }
    }
  }

  return clone;
}

async function pollComfyHistory(baseUrl: string, promptId: string, signal?: AbortSignal): Promise<any> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    const res = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`, { signal });
    if (!res.ok) throw new Error(`ComfyUI history failed: ${res.status}`);
    const json = await res.json();
    const entry = json?.[promptId];
    const outputs = entry?.outputs;
    if (outputs && typeof outputs === 'object') return outputs;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('ComfyUI generation timeout');
}

function extractFirstImage(outputs: Record<string, any>): { filename: string; subfolder?: string; type?: string } | null {
  for (const out of Object.values(outputs)) {
    const images = out?.images;
    if (Array.isArray(images) && images.length > 0) {
      const first = images[0];
      if (first?.filename) return first;
    }
  }
  return null;
}

async function generateWithComfy(params: ImageGenerateParams, signal?: AbortSignal): Promise<ImageGenerateResult> {
  const baseUrl = normalizeBaseUrl(params.baseUrl || 'http://127.0.0.1:8188');
  const promptWorkflow = withPromptInjected(params.workflow, params.prompt, params.negativePrompt);

  const submitRes = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: promptWorkflow }),
    signal,
  });
  if (!submitRes.ok) throw new Error(`ComfyUI request failed: ${submitRes.status}`);
  const submitJson = await submitRes.json();
  const promptId = submitJson?.prompt_id;
  if (!promptId) throw new Error('ComfyUI did not return prompt_id');

  const outputs = await pollComfyHistory(baseUrl, promptId, signal);
  const image = extractFirstImage(outputs);
  if (!image) throw new Error('No image in ComfyUI output');

  const paramsView = new URLSearchParams({
    filename: String(image.filename),
    subfolder: String(image.subfolder ?? ''),
    type: String(image.type ?? 'output'),
  });
  return { imageUrl: `${baseUrl}/view?${paramsView.toString()}` };
}

export async function generateImageWithProvider(
  provider: ImageGenProvider,
  params: ImageGenerateParams,
  signal?: AbortSignal,
): Promise<ImageGenerateResult> {
  if (provider === 'comfyui') return generateWithComfy(params, signal);
  throw new Error(`Unsupported image provider: ${provider}`);
}
