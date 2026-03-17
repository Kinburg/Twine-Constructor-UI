const SC_TEMPLATE_KEY = 'purl-sc-template';
const SC_VERSION_KEY  = 'purl-sc-version';

export function hasSCTemplate(): boolean {
  return !!localStorage.getItem(SC_TEMPLATE_KEY);
}

export function getSCTemplate(): string | null {
  return localStorage.getItem(SC_TEMPLATE_KEY);
}

export function getSCVersion(): string | null {
  return localStorage.getItem(SC_VERSION_KEY);
}

export function clearSCTemplate(): void {
  localStorage.removeItem(SC_TEMPLATE_KEY);
  localStorage.removeItem(SC_VERSION_KEY);
}

/**
 * Parse SugarCube 2 format.js content.
 * format.js calls window.storyFormat({ name, version, source, ... })
 * We intercept that call and return { source, version }.
 */
export function parseSCFormatJs(jsContent: string): { source: string; version: string } | null {
  try {
    let captured: { source: string; version: string } | null = null;

    // format.js calls window.storyFormat(data). We provide a fake window.
    const fn = new Function('window', jsContent);
    fn({
      storyFormat: (data: { source?: string; version?: string; name?: string }) => {
        if (data.source) {
          captured = { source: data.source, version: data.version ?? 'unknown' };
        }
      },
    });

    return captured;
  } catch (e) {
    console.error('Failed to parse format.js:', e);
    return null;
  }
}

export function storeSCTemplate(source: string, version: string): void {
  localStorage.setItem(SC_TEMPLATE_KEY, source);
  localStorage.setItem(SC_VERSION_KEY, version);
}
