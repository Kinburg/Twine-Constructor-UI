import type { ImageGenProvider } from '../../types';

export interface ComfyProgress {
  current: number;
  total: number;
}

export interface ImageGenerateParams {
  baseUrl: string;
  workflow: Record<string, any>;
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  genWidth?: number;   // generation resolution width (0 = auto)
  genHeight?: number;  // generation resolution height (0 = auto)
  // Pollinations specific
  pollinationsModel?: string;
  pollinationsToken?: string;
  // Progress callback (ComfyUI only, via WebSocket)
  onProgress?: (progress: ComfyProgress) => void;
}

export interface ImageGenerateResult {
  imageUrl?: string;    // URL to download image (ComfyUI)
  bytes?: number[];     // Raw image bytes
  contentType?: string; // MIME type when bytes are present
}

async function requestJson(url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}): Promise<{ status: number; json: any }> {
  if (typeof window !== 'undefined' && window.electronAPI?.httpRequest) {
    // NOTE: Electron IPC does not support AbortSignal — check signal.aborted manually before calling.
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

function replaceTemplateTokens(
  value: string,
  prompt: string,
  negativePrompt?: string,
  seed?: number,
  genWidth?: number,
  genHeight?: number,
): string {
  const neg = negativePrompt ?? '';
  const seedText = Number.isFinite(seed) ? String(seed) : '';
  const widthText = genWidth && genWidth > 0 ? String(genWidth) : '';
  const heightText = genHeight && genHeight > 0 ? String(genHeight) : '';
  return value
    .replaceAll('${prompt}', prompt)
    .replaceAll('${negative_prompt}', neg)
    .replaceAll('${seed}', seedText)
    .replaceAll('${width}', widthText)
    .replaceAll('${height}', heightText);
}

function withTemplateInjected(
  workflow: Record<string, any>,
  prompt: string,
  negativePrompt?: string,
  seed?: number,
  genWidth?: number,
  genHeight?: number,
): Record<string, any> {
  const clone = JSON.parse(JSON.stringify(workflow));

  for (const node of Object.values(clone as Record<string, any>)) {
    if (!node || typeof node !== 'object' || typeof node.inputs !== 'object') continue;
    const inputs = node.inputs as Record<string, any>;

    // Token-based prompt injection.
    // Use `${prompt}`, `${negative_prompt}`, `${seed}`, `${width}`, `${height}` in workflow text fields.
    for (const [key, val] of Object.entries(inputs)) {
      if (typeof val === 'string' && (
        val.includes('${prompt}') || val.includes('${negative_prompt}') ||
        val.includes('${seed}') || val.includes('${width}') || val.includes('${height}')
      )) {
        const replaced = replaceTemplateTokens(val, prompt, negativePrompt, seed, genWidth, genHeight);
        // Preserve numeric type for fields like seed/width/height when token-only template is used.
        if (val.trim() === '${seed}' && Number.isFinite(seed)) {
          inputs[key] = seed;
        } else if (val.trim() === '${width}' && genWidth && genWidth > 0) {
          inputs[key] = genWidth;
        } else if (val.trim() === '${height}' && genHeight && genHeight > 0) {
          inputs[key] = genHeight;
        } else {
          inputs[key] = replaced;
        }
      }
    }
  }

  return clone;
}

/**
 * Poll /history until the prompt result is ready.
 * Checks signal.aborted at each iteration (Electron IPC ignores AbortSignal natively).
 */
async function pollComfyHistory(baseUrl: string, promptId: string, signal?: AbortSignal): Promise<any> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const { status, json } = await requestJson(`${baseUrl}/history/${encodeURIComponent(promptId)}`);
    if (status < 200 || status >= 300) throw new Error(`ComfyUI history failed: ${status}`);
    const entry = json?.[promptId];
    const outputs = entry?.outputs;
    if (outputs && typeof outputs === 'object') return outputs;
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('ComfyUI generation timeout');
}

/**
 * Connect to ComfyUI WebSocket for real-time step progress.
 * Returns a cleanup function. Falls back silently if WebSocket is unavailable.
 *
 * In Electron, direct WebSocket from the renderer may be blocked by
 * same-origin policy. We attempt the connection and log a warning on failure
 * so the user sees an indeterminate bar instead.
 */
function connectComfyWebSocket(
  baseUrl: string,
  clientId: string,
  onProgress: (p: ComfyProgress) => void,
  signal?: AbortSignal,
): () => void {
  const wsUrl = baseUrl.replace(/^https?/, (m) => m === 'https' ? 'wss' : 'ws') + `/ws?clientId=${clientId}`;
  let ws: WebSocket | null = null;

  try {
    ws = new WebSocket(wsUrl);

    ws.addEventListener('open', () => {
      console.log('[ImageGen] WebSocket connected to ComfyUI for progress updates');
    });

    ws.addEventListener('error', () => {
      console.warn('[ImageGen] WebSocket connection to ComfyUI failed — progress will be unavailable');
    });

    ws.addEventListener('message', (evt) => {
      // ComfyUI sends both text (JSON) and binary (preview images) messages.
      // Only parse text messages.
      if (typeof evt.data !== 'string') return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === 'progress') {
          const { value, max } = msg.data ?? {};
          if (typeof value === 'number' && typeof max === 'number' && max > 0) {
            onProgress({ current: value, total: max });
          }
        }
      } catch {
        // ignore malformed messages
      }
    });
  } catch {
    // WebSocket constructor failed (should be rare)
  }

  const cleanup = () => {
    ws?.close();
    ws = null;
  };

  signal?.addEventListener('abort', cleanup, { once: true });
  return cleanup;
}

async function generateWithComfy(params: ImageGenerateParams, signal?: AbortSignal): Promise<ImageGenerateResult> {
  const baseUrl = normalizeBaseUrl(params.baseUrl || 'http://127.0.0.1:8188');
  const promptWorkflow = withTemplateInjected(
    params.workflow, params.prompt, params.negativePrompt, params.seed, params.genWidth, params.genHeight,
  );

  // Use a clientId so ComfyUI associates this prompt with our WebSocket connection.
  const clientId = crypto.randomUUID();

  // Connect WebSocket for progress updates before submitting the prompt.
  let wsCleanup: (() => void) | null = null;
  if (params.onProgress) {
    wsCleanup = connectComfyWebSocket(baseUrl, clientId, params.onProgress, signal);
  }

  let promptId: string | undefined;
  try {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const { status, json: submitJson } = await requestJson(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptWorkflow, client_id: clientId }),
      signal,
    });
    if (status < 200 || status >= 300) throw new Error(`ComfyUI request failed: ${status}`);
    promptId = submitJson?.prompt_id;
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
  } catch (err) {
    // If cancelled, interrupt the running generation AND remove from queue.
    if (signal?.aborted) {
      // POST /interrupt stops the currently executing generation inside ComfyUI.
      requestJson(`${baseUrl}/interrupt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => {});
      // POST /queue { delete: [...] } removes a queued (not yet running) prompt.
      if (promptId) {
        requestJson(`${baseUrl}/queue`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ delete: [promptId] }),
        }).catch(() => {});
      }
    }
    throw err;
  } finally {
    wsCleanup?.();
  }
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

async function generateWithPollinations(params: ImageGenerateParams, signal?: AbortSignal): Promise<ImageGenerateResult> {
  const model = params.pollinationsModel?.trim() || 'flux';
  const width = params.genWidth && params.genWidth > 0 ? params.genWidth : 1024;
  const height = params.genHeight && params.genHeight > 0 ? params.genHeight : width;

  const urlParams = new URLSearchParams({ model, width: String(width), height: String(height) });
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
