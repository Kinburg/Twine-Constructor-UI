import type { ImageGenProvider } from '../../types';

export interface ImageGenerateParams {
  baseUrl: string;
  workflow: Record<string, any>;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
}

export interface ImageGenerateResult {
  imageUrl: string;
}

async function requestJson(url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}): Promise<{ status: number; json: any }> {
  if (typeof window !== 'undefined' && window.electronAPI?.httpRequest) {
    const res = await window.electronAPI.httpRequest({
      url,
      method: init?.method,
      headers: init?.headers,
      body: init?.body,
    });
    let json: any = null;
    try { json = JSON.parse(res.text); } catch { json = null; }
    return { status: res.status, json };
  }
  const res = await fetch(url, init);
  return { status: res.status, json: await res.json() };
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function replaceTemplateTokens(value: string, prompt: string, negativePrompt?: string, seed?: number): string {
  const neg = negativePrompt ?? '';
  const seedText = Number.isFinite(seed) ? String(seed) : '';
  return value
    .replaceAll('${prompt}', prompt)
    .replaceAll('${negative_prompt}', neg)
    .replaceAll('${seed}', seedText);
}

function withTemplateInjected(
  workflow: Record<string, any>,
  prompt: string,
  negativePrompt?: string,
  seed?: number,
): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(workflow));

  for (const node of Object.values(clone as Record<string, any>)) {
    if (!node || typeof node !== 'object' || typeof node.inputs !== 'object') continue;
    const inputs = node.inputs as Record<string, any>;

    // Token-based prompt injection.
    // Use `${prompt}` and `${negative_prompt}` directly in workflow text fields.
    for (const [key, val] of Object.entries(inputs)) {
      if (typeof val === 'string' && (val.includes('${prompt}') || val.includes('${negative_prompt}') || val.includes('${seed}'))) {
        const replaced = replaceTemplateTokens(val, prompt, negativePrompt, seed);
        // Preserve numeric type for fields like seed when token-only template is used.
        if (val.trim() === '${seed}' && Number.isFinite(seed)) {
          inputs[key] = seed;
        } else {
          inputs[key] = replaced;
        }
      }
    }
  }

  return clone;
}

async function pollComfyHistory(baseUrl: string, promptId: string, signal?: AbortSignal): Promise<any> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    const { status, json } = await requestJson(`${baseUrl}/history/${encodeURIComponent(promptId)}`, { signal });
    if (status < 200 || status >= 300) throw new Error(`ComfyUI history failed: ${status}`);
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
  const promptWorkflow = withTemplateInjected(params.workflow, params.prompt, params.negativePrompt, params.seed);

  const { status, json: submitJson } = await requestJson(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: promptWorkflow }),
    signal,
  });
  if (status < 200 || status >= 300) throw new Error(`ComfyUI request failed: ${status}`);
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
