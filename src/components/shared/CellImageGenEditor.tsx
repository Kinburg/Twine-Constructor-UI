/**
 * Adapter that wraps ImageGenBlockEditor for use inside a table / panel cell.
 * Converts CellImageGen ↔ ImageGenBlock so the full generation UI is reused unchanged.
 */
import type { CellImageGen, ImageGenBlock } from '../../types';
import { ImageGenBlockEditor } from '../blocks/ImageGenBlockEditor';

export function CellImageGenEditor({
  content,
  cellId,
  sceneId,
  onUpdate,
}: {
  content: CellImageGen;
  cellId: string;
  /** Pass the scene id when available (TableBlock context). Empty string is fine for PanelEditor. */
  sceneId: string;
  onUpdate: (patch: Partial<CellImageGen>) => void;
}) {
  // Build a fake ImageGenBlock so ImageGenBlockEditor can operate normally.
  // `provider` is a legacy/display field — the real provider comes from editorPrefsStore.
  const fakeBlock: ImageGenBlock = {
    id: cellId,
    type: 'image-gen',
    provider: 'pollinations',
    workflowFile: content.workflowFile,
    promptMode: content.promptMode,
    llmPromptMode: content.llmPromptMode,
    prompt: content.prompt,
    negativePrompt: content.negativePrompt,
    styleHints: content.styleHints,
    seedMode: content.seedMode,
    seed: content.seed,
    width: content.width,
    genWidth: content.genWidth,
    genHeight: content.genHeight,
    alt: content.alt,
    src: content.src,
    approvedHistoryId: content.approvedHistoryId,
    lastApprovedDir: content.lastApprovedDir,
    history: content.history,
  };

  return (
    <ImageGenBlockEditor
      block={fakeBlock}
      sceneId={sceneId}
      onUpdate={(patch: Partial<ImageGenBlock>) => {
        // ImageGenBlockEditor never patches id/type/delay/provider — safe cast.
        onUpdate(patch as Partial<CellImageGen>);
      }}
    />
  );
}
