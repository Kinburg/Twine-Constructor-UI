import { usePluginStore } from '../../store/pluginStore';
import { useEditorStore } from '../../store/editorStore';
import { useEditorPrefsStore } from '../../store/editorPrefsStore';
import { useT } from '../../i18n';
import { useConfirm } from '../shared/ConfirmModal';
import type { PluginBlockDef } from '../../types';

export function PluginManager() {
  const t = useT();
  const { plugins, loading, error, deletePlugin, duplicatePlugin, exportPlugin, importPlugin } = usePluginStore();
  const openPluginEditor = useEditorStore((s) => s.openPluginEditor);
  const confirmDelete = useEditorPrefsStore((s) => s.confirmDeleteCharacter);
  const { ask, modal: confirmModal } = useConfirm();

  return (
    <div className="p-2 flex flex-col gap-1">
      {/* Toolbar */}
      <div className="flex gap-1 pb-1 border-b border-slate-800 mb-1">
        <button
          className="flex-1 text-xs text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 transition-colors cursor-pointer border border-dashed border-slate-700 hover:border-indigo-600"
          onClick={() => openPluginEditor('new')}
        >
          {t.pluginManager.newPlugin}
        </button>
        <button
          className="text-xs text-slate-400 hover:text-indigo-300 hover:bg-slate-800 rounded px-2 py-1.5 transition-colors cursor-pointer border border-dashed border-slate-700 hover:border-indigo-600"
          onClick={importPlugin}
          title={t.pluginManager.importPlugin}
        >
          📥
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 italic px-2 py-1">{t.pluginManager.errorLoading}: {error}</p>
      )}

      {loading && plugins.length === 0 && (
        <p className="text-xs text-slate-500 italic px-2 py-1">…</p>
      )}

      {plugins.map((p) => (
        <PluginRow
          key={p.id}
          def={p}
          onEdit={() => openPluginEditor(p.id)}
          onDuplicate={() => duplicatePlugin(p.id)}
          onExport={() => exportPlugin(p.id)}
          onDelete={() => {
            if (confirmDelete) {
              ask({ message: t.pluginManager.confirmDelete(p.name), variant: 'danger' }, () => deletePlugin(p.id));
            } else {
              deletePlugin(p.id);
            }
          }}
        />
      ))}

      {!loading && plugins.length === 0 && !error && (
        <p className="text-xs text-slate-600 italic px-2 py-1">{t.pluginManager.empty}</p>
      )}

      {confirmModal}
    </div>
  );
}

function PluginRow({
  def, onEdit, onDuplicate, onExport, onDelete,
}: {
  def: PluginBlockDef;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 rounded border-l-4 border border-slate-700 hover:bg-slate-800 transition-colors cursor-pointer"
      style={{ borderLeftColor: def.color }}
      onClick={onEdit}
    >
      <span className="text-base leading-none shrink-0">{def.icon || '🧩'}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-slate-200 truncate">{def.name}</div>
        {def.description && (
          <div className="text-[10px] text-slate-500 truncate">{def.description}</div>
        )}
      </div>
      <button
        className="text-slate-600 hover:text-indigo-400 text-xs cursor-pointer shrink-0"
        title={t.pluginManager.duplicatePlugin}
        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
      >⎘</button>
      <button
        className="text-slate-600 hover:text-indigo-400 text-xs cursor-pointer shrink-0"
        title={t.pluginManager.exportPlugin}
        onClick={(e) => { e.stopPropagation(); onExport(); }}
      >📤</button>
      <button
        className="text-slate-600 hover:text-red-400 text-xs cursor-pointer shrink-0"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
      >🗑️</button>
    </div>
  );
}
