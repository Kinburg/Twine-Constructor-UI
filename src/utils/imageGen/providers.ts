import type { ImageGenProvider } from '../../types';

export interface ImageGenerateParams {
  baseUrl: string;
  workflow: Record<string, any>;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  // Pollinations specific
  pollinationsModel?: string;
  pollinationsToken?: string;
  width?: number;
}

export interface ImageGenerateResult {
  imageUrl?: string;    // URL to download image (ComfyUI)
  bytes?: number[];     // Raw image bytes (HuggingFace)
  contentType?: string; // MIME type when bytes are present
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

async function generateWithPollinations(params: ImageGenerateParams, signal?: AbortSignal): Promise<ImageGenerateResult> {
  const model = params.pollinationsModel?.trim() || 'flux';
  const width = params.width && params.width > 0 ? params.width : 1024;

  const urlParams = new URLSearchParams({ model, width: String(width), height: String(width) });
  if (Number.isFinite(params.seed)) urlParams.set('seed', String(params.seed));

  // In Electron: use direct URL via main process (no CORS). In browser dev: use Vite proxy.
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.httpRequestBinary;
  const baseUrl = isElectron ? 'https://gen.pollinations.ai' : '/pollinations';
  const url = `${baseUrl}/image/${encodeURIComponent(params.prompt)}?${urlParams}`;

  const fetchHeaders: Record<string, string> = {};
  if (params.pollinationsToken?.trim()) fetchHeaders['Authorization'] = `Bearer ${params.pollinationsToken.trim()}`;

  if (isElectron) {
    const res = await window.electronAPI!.httpRequestBinary({ url, headers: fetchHeaders });
    if (res.status < 200 || res.status >= 300) throw new Error(`Pollinations API error: ${res.status}`);
    return { bytes: res.bytes, contentType: res.headers['content-type'] ?? 'image/jpeg' };
  }

  const res = await fetch(url, { signal, headers: fetchHeaders });
  if (!res.ok) {
    const ct = res.headers.get('content-type') ?? '';
    const errText = ct.includes('json') || ct.includes('text')
      ? await res.text().catch(() => '')
      : `(binary body, content-type: ${ct})`;
    throw new Error(`Pollinations API error: ${res.status} — ${errText}`);
  }

  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  const bytes = Array.from(new Uint8Array(await res.arrayBuffer()));
  return { bytes, contentType };
}

export async function generateImageWithProvider(
  provider: ImageGenProvider,
  params: ImageGenerateParams,
  signal?: AbortSignal,
): Promise<ImageGenerateResult> {
  if (provider === 'comfyui') return generateWithComfy(params, signal);
  if (provider === 'pollinations') return generateWithPollinations(params, signal);
  throw new Error(`Unsupported image provider: ${provider}`);
}
