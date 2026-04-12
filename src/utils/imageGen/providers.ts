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
  /** Base64-encoded reference image injected as ${charImage} in ComfyUI workflow nodes. */
  charImageBase64?: string;
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
  let json: any = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
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
  charImage?: string,
): string {
  const neg = negativePrompt ?? '';
  const seedText = Number.isFinite(seed) ? String(seed) : '';
  const widthText = genWidth && genWidth > 0 ? String(genWidth) : '';
  const heightText = genHeight && genHeight > 0 ? String(genHeight) : '';
  
  let res = value
    .replaceAll('${prompt}', prompt)
    .replaceAll('${negative_prompt}', neg)
    .replaceAll('${charImage}', charImage ?? '');
  
  if (seedText) res = res.replaceAll('${seed}', seedText);
  if (widthText) res = res.replaceAll('${width}', widthText);
  if (heightText) res = res.replaceAll('${height}', heightText);
  
  return res;
}

function withTemplateInjected(
  workflow: Record<string, any>,
  prompt: string,
  negativePrompt?: string,
  seed?: number,
  genWidth?: number,
  genHeight?: number,
  charImage?: string,
): Record<string, any> {
  // ComfyUI "API Format" often nested under a key or just a flat object of nodes.
  // If it's a full UI export, it has .nodes and .links which API doesn't use.
  const source = workflow.prompt || workflow;
  const clone = JSON.parse(JSON.stringify(source));

  for (const node of Object.values(clone as Record<string, any>)) {
    if (!node || typeof node !== 'object' || typeof node.inputs !== 'object') continue;
    const inputs = node.inputs as Record<string, any>;

    for (const [key, val] of Object.entries(inputs)) {
      if (typeof val === 'string' && (
        val.includes('${prompt}') || val.includes('${negative_prompt}') ||
        val.includes('${seed}') || val.includes('${width}') || val.includes('${height}') ||
        val.includes('${charImage}')
      )) {
        const trimmed = val.trim();
        if (trimmed === '${seed}' && Number.isFinite(seed)) {
          inputs[key] = seed;
        } else if (trimmed === '${width}' && genWidth && genWidth > 0) {
          inputs[key] = genWidth;
        } else if (trimmed === '${height}' && genHeight && genHeight > 0) {
          inputs[key] = genHeight;
        } else {
          inputs[key] = replaceTemplateTokens(val, prompt, negativePrompt, seed, genWidth, genHeight, charImage);
        }
      }
    }
  }

  return clone;
}

async function pollComfyHistory(baseUrl: string, promptId: string, signal?: AbortSignal): Promise<any> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const { status, json } = await requestJson(`${baseUrl}/history/${encodeURIComponent(promptId)}`);
    if (status < 200 || status >= 300) throw new Error(`ComfyUI history failed: ${status}`);
    
    const entry = json?.[promptId];
    if (entry) {
      const statusInfo = entry.status;
      if (statusInfo && statusInfo.status_str && statusInfo.status_str !== 'success') {
        let errorMsg = '';
        if (Array.isArray(statusInfo.messages)) {
          const execError = statusInfo.messages.find((m: any) => m?.[0] === 'execution_error');
          if (execError && execError[1]) {
            const d = execError[1];
            errorMsg = `Node ${d.node_id} (${d.node_type}): ${d.exception_message}`;
          } else {
            errorMsg = statusInfo.messages.map((m: any) => m?.[1]?.message || JSON.stringify(m)).join('; ');
          }
        }
        throw new Error(`ComfyUI execution failed: ${errorMsg || statusInfo.status_str}`);
      }
      return entry.outputs;
    }
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('ComfyUI generation timeout');
}

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
      console.log('[ImageGen] WebSocket connected to ComfyUI');
    });
    ws.addEventListener('error', (err) => {
      console.warn('[ImageGen] WebSocket connection failed', err);
    });
    ws.addEventListener('message', (evt) => {
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
  } catch (e) {
    console.error('[ImageGen] Failed to create WebSocket:', e);
  }

  const cleanup = () => { ws?.close(); ws = null; };
  signal?.addEventListener('abort', cleanup, { once: true });
  return cleanup;
}

async function generateWithComfy(params: ImageGenerateParams, signal?: AbortSignal): Promise<ImageGenerateResult> {
  const baseUrl = normalizeBaseUrl(params.baseUrl || 'http://127.0.0.1:8188');
  
  // Strip any wrapping or extra data if the user provided a full export
  const promptWorkflow = withTemplateInjected(
    params.workflow, params.prompt, params.negativePrompt, params.seed, params.genWidth, params.genHeight,
    params.charImageBase64,
  );

  console.log('[ImageGen] Submitting prompt to ComfyUI:', promptWorkflow);

  const clientId = crypto.randomUUID();
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
    
    if (status < 200 || status >= 300) {
      const err = submitJson?.error;
      const message = typeof err === 'object' ? (err.message || err.type) : (err || submitJson?.message);
      const details = submitJson?.node_errors ? Object.entries(submitJson.node_errors)
        .map(([id, info]: [any, any]) => `Node ${id}: ${info.errors?.map((e: any) => e.message).join(', ')}`)
        .join('; ') : '';
      throw new Error(`ComfyUI request failed: ${status}${message ? ` - ${message}` : ''}${details ? ` (${details})` : ''}`);
    }
    
    promptId = submitJson?.prompt_id;
    if (!promptId) throw new Error('ComfyUI did not return prompt_id');

    const outputs = await pollComfyHistory(baseUrl, promptId, signal);
    const image = extractFirstImage(outputs);
    if (!image) {
      console.warn('[ImageGen] No image found in outputs:', outputs);
      throw new Error('No image in ComfyUI output. Check if your workflow has a "Save Image" or "Preview Image" node.');
    }

    const paramsView = new URLSearchParams({
      filename: String(image.filename),
      subfolder: String(image.subfolder ?? ''),
      type: String(image.type ?? 'output'),
    });
    return { imageUrl: `${baseUrl}/view?${paramsView.toString()}` };
  } catch (err) {
    if (signal?.aborted) {
      requestJson(`${baseUrl}/interrupt`, { method: 'POST', body: '{}' }).catch(() => {});
      if (promptId) {
        requestJson(`${baseUrl}/queue`, {
          method: 'POST',
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
