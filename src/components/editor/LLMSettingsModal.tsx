// ─────────────────────────────────────────────────────────────────────────────
//  AISettingsModal — thin wrapper.
//
//  AI/LLM settings live inside EditorPrefsModal as the "AI / LLM" tab.
//  This wrapper opens that modal pre-focused on the AI tab, so existing
//  call sites (App.tsx, Header.tsx) that used the standalone AI Settings
//  modal keep working.
// ─────────────────────────────────────────────────────────────────────────────

import { EditorPrefsModal } from './EditorPrefsModal';

interface Props {
  onClose: () => void;
}

export function AISettingsModal({ onClose }: Props) {
  return <EditorPrefsModal onClose={onClose} initialTab="ai" />;
}
