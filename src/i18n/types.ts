/**
 * Shape of a single locale file.
 * Add new keys here, then fill them in every locale file.
 */
export interface Translations {
  /** Display name shown in the language selector */
  locale: { name: string };

  sidebar: {
    scenes: string;
    characters: string;
    variables: string;
    assets: string;
    panel: string;
  };

  scene: {
    add: string;
    drag: string;
    rename: string;
    duplicate: string;
    delete: string;
    confirmDelete: (name: string) => string;
    label: string;
    tags: string;
    noTags: string;
    tagsPlaceholder: string;
    editTagsTitle: string;
    empty: string;
    selectPrompt: string;
  };

  block: {
    /** Block type display names */
    text: string;
    dialogue: string;
    choice: string;
    condition: string;
    variableSet: string;
    button: string;
    inputField: string;
    image: string;
    video: string;
    /** Action tooltips / labels */
    drag: string;
    copy: string;
    duplicate: string;
    delete: string;
    paste: (typeName: string) => string;
    unsupportedNested: string;
  };

  addBlock: {
    trigger: string;
    cancel: string;
    text:        { label: string; desc: string };
    dialogue:    { label: string; desc: string };
    choice:      { label: string; desc: string };
    condition:   { label: string; desc: string };
    variableSet: { label: string; desc: string };
    button:      { label: string; desc: string };
    inputField:  { label: string; desc: string };
    image:       { label: string; desc: string };
    video:       { label: string; desc: string };
  };

  condition: {
    addBranch: string;
    addElse: string;
    noBranches: string;
    varPlaceholder: string;
    valuePlaceholder: string;
  };

  header: {
    renameProjectTitle: string;
    open: string;
    openTitle: string;
    new: string;
    confirmNew: string;
    save: string;
    saving: string;
    saveTitle: (dir: string) => string;
    saveNoDir: string;
    saveMoreOptions: string;
    saveAsFolder: string;
    saveAsFolderDesc: string;
    openFolder: string;
    openFolderDesc: string;
    scRuntime: string;
    scLoaded: (version: string) => string;
    confirmClearSC: string;
    exportTwee: string;
    exportTweeTitle: string;
    exportHtml: string;
    exportMoreOptions: string;
    exportSaveInFolder: string;
    exportSaveInFolderDesc: string;
    exportSaveAs: string;
    exportSaveAsDesc: string;
    confirmHtmlSaved: string;
    language: string;
  };
}
