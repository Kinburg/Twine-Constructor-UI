/**
 * Shape of a single locale file.
 * Add new keys here, then fill them in every locale file.
 */
export interface Translations {
  /** Display name shown in the language selector */
  locale: { name: string };

  common: {
    confirm: string;
    cancel: string;
    delete: string;
  };

  sidebar: {
    scenes: string;
    characters: string;
    variables: string;
    assets: string;
    panel: string;
    watchers: string;
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
    note: string;
    notePlaceholder: string;
    filterNoScenes: string;
    createTitle: string;
    editTitle: string;
    fieldName: string;
    nameTaken: string;
    nameEmpty: string;
    addGroup: string;
    groupCreateTitle: string;
    groupEditTitle: string;
    groupFieldName: string;
    groupNameTaken: string;
    groupNameEmpty: string;
    groupConfirmDelete: (name: string) => string;
    groupUngrouped: string;
  };

  block: {
    /** Block type display names */
    text: string;
    dialogue: string;
    choice: string;
    condition: string;
    variableSet: string;
    button: string;
    link: string;
    inputField: string;
    image: string;
    video: string;
    raw: string;
    note: string;
    table: string;
    include: string;
    divider: string;
    checkbox: string;
    radio: string;
    function: string;
    popup: string;
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
    link:        { label: string; desc: string };
    inputField:  { label: string; desc: string };
    image:       { label: string; desc: string };
    video:       { label: string; desc: string };
    raw:         { label: string; desc: string };
    note:        { label: string; desc: string };
    table:       { label: string; desc: string };
    include:     { label: string; desc: string };
    divider:     { label: string; desc: string };
    checkbox:    { label: string; desc: string };
    radio:       { label: string; desc: string };
    function:    { label: string; desc: string };
    popup:       { label: string; desc: string };
  };

  includeBlock: {
    passageLabel:       string;
    passagePlaceholder: string;
    maxWidthLabel:      string;
    maxWidthSuffix:     string;  // 'px' / '(0 = авто)'
    borderedLabel:      string;
    borderColorLabel:   string;
    thicknessSuffix:    string;  // 'px'
    radiusSuffix:       string;  // 'px'
    paddingLabel:       string;
    paddingSuffix:      string;  // 'px'
    bgColorLabel:       string;
  };

  condition: {
    addBranch: string;
    addElse: string;
    noBranches: string;
    varPlaceholder: string;
    valuePlaceholder: string;
    rangeToggle:         string;  // tooltip for range-mode button
    rangeMinPlaceholder: string;
    rangeMaxPlaceholder: string;
    opContains:    string;  // 'contains'
    opNotContains: string;  // '!contains'
    opEmpty:       string;  // 'empty'
    opNotEmpty:    string;  // '!empty'
  };

  header: {
    searchPlaceholder: string;
    clearSearch: string;
    undo: string;
    undoTitle: string;
    redo: string;
    redoTitle: string;
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
    scLoadTitle: string;
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
    previewCode: string;
    previewCodeTitle: string;
    previewCodeClose: string;
    graph: string;
    graphTitle: string;
    graphClose: string;
    errorSave: (e: unknown) => string;
    errorInvalidProject: string;
    dialogSelectSC: string;
    errorInvalidSC: string;
    scLoadedAlert: (version: string) => string;
    errorReadFile: (e: unknown) => string;
    errorExportHtml: (e: unknown) => string;
    dialogSaveHtml: string;
    errorExportTwee: (e: unknown) => string;
    dialogSaveTwee: string;
    menuTitle: string;
    menuSectionFile: string;
    menuSectionSettings: string;
    newDesc: string;
    projectSettings: string;
    projectSettingsDesc: string;
    editorPrefs: string;
    editorPrefsDesc: string;
  };

  // ─── Asset manager ──────────────────────────────────────────────────────────
  assets: {
    errorCreateFolder: (e: unknown) => string;
    titleSelectFiles: string;
    filterMedia: string;
    filterImages: string;
    filterVideos: string;
    errorAddFiles: (e: unknown) => string;
    groupNamePlaceholder: string;
    addGroupTitle: string;
    addGroup: string;
    addFilesRootTitle: string;
    addFiles: string;
    empty: string;
    addSubgroupTitle: string;
    addFilesToGroupTitle: string;
    deleteGroupTitle: string;
    confirmDeleteGroup: (name: string) => string;
    emptyGroup: string;
    videoTitle: string;
    removeTitle: string;
  };

  // ─── Characters ─────────────────────────────────────────────────────────────
  characters: {
    defaultName: string;
    confirmDelete: (name: string) => string;
    empty: string;
    add: string;
    noName: string;
    fieldName: string;
    fieldNameColor: string;
    fieldDialogBg: string;
    fieldAccent: string;
    fieldTextColor: string;
    exampleLine: string;
    avatarLabel: string;
    avatarStatic: string;
    avatarDynamic: string;
    fieldImage: string;
    fieldVariable: string;
    selectVariable: string;
    mappingsLabel: string;
    addMapping: string;
    noMappings: string;
    defaultMapping: string;
    createTitle: string;
    editTitle: string;
    save: string;
    nameTaken: string;
    nameEmpty: string;
    customVarsSection: string;
    customVarsAdd: string;
    customVarsNamePlaceholder: string;
    customVarsEmpty: string;
    customVarsNameEmpty: string;
    customVarsConfirmDelete: (name: string) => string;
  };

  // ─── Variables ──────────────────────────────────────────────────────────────
  variables: {
    groupNamePlaceholder: string;
    addVariable: string;
    addGroup: string;
    empty: string;
    confirmDeleteGroup: (name: string) => string;
    confirmDeleteVar: (name: string) => string;
    fieldName: string;
    fieldType: string;
    fieldDefault: string;
    fieldDescription: string;
    typeNumber: string;
    typeString: string;
    typeBoolean: string;
    typeArray: string;
    defaultPlaceholderNumber: string;
    defaultPlaceholderText: string;
    descriptionPlaceholder: string;
  };

  // ─── Shared: cell edit modal (Panel + Table) ────────────────────────────────
  cellModal: {
    title: string;
    contentType: string;
    done: string;
    selectVariable: string;
    selectAsset: string;
    prefix: string;
    suffix: string;
    maximum: string;
    colorRange: string;
    colorRangeOff: string;
    colorAt0: string;
    colorAt100: string;
    fillColor: string;
    barBgColor: string;
    textColor: string;
    inherited: string;
    vertical: string;
    showNumbers: string;
    imageLabel: string;
    objectFit: string;
    fitCover: string;
    fitContain: string;
    mappingsLabel: string;
    addMapping: string;
    matchMode: string;
    matchExact: string;
    matchRange: string;
    valueLabel: string;
    fromLabel: string;
    toLabel: string;
    fileLabel: string;
    defaultLabel: string;
    rawCodeLabel: string;
    typeText: string;
    typeVariable: string;
    typeProgress: string;
    typeImageStatic: string;
    typeImageBound: string;
    typeImageBoundShort: string;
    typeRaw: string;
    typeButton: string;
    // ── Button cell fields ──
    buttonLabelField: string;
    buttonActionsTitle: string;
    buttonAddAction: string;
    buttonNoActions: string;
    buttonDeleteAction: string;
    buttonSelectVariable: string;
    buttonTextPlaceholder: string;
    buttonNavigateTitle: string;
    buttonTargetNone: string;
    buttonTargetScene: string;
    buttonTargetBack: string;
    buttonSceneLabel: string;
    buttonNoScene: string;
    // ── List cell fields ──
    typeList: string;
    listVariableLabel: string;
    listSeparatorLabel: string;
    listEmptyTextLabel: string;
    listPrefixLabel: string;
    listSuffixLabel: string;
  };

  // ─── Shared: rows/cells editor UI (Panel + Table) ──────────────────────────
  rowsEditor: {
    sectionTitle: string;
    noRows: string;
    rowLabel: (n: number) => string;
    heightLabel: string;
    confirmDeleteRow: string;
    noCells: string;
    addCell: string;
    addRow: string;
    equalWidth: string;
    equalWidthTitle: string;
    editTitle: string;
    deleteTitle: string;
    cellTextPlaceholder: string;
    cellCodePlaceholder: string;
  };

  // ─── Shared: style editor (Panel + Table) ──────────────────────────────────
  tableStyle: {
    title: string;
    rowGap: string;
    borders: string;
    outerBorder: string;
    betweenRows: string;
    betweenCells: string;
    thickness: string;
    borderColor: string;
  };

  // ─── Panel editor ───────────────────────────────────────────────────────────
  panel: {
    title: string;
    moveLeft: string;
    moveRight: string;
    deleteTab: string;
    confirmDeleteTab: (label: string) => string;
    tabNamePlaceholder: string;
    addTab: string;
    noTabs: string;
    tabNameLabel: string;
  };

  // ─── Block editors ──────────────────────────────────────────────────────────
  textBlock: {
    placeholder: string;
    liveUpdateLabel: string;
    liveUpdateDesc: string;
  };

  dialogueBlock: {
    characterLabel: string;
    noCharacters: string;
    selectChar: string;
    sideLabel: string;
    sideLeft: string;
    sideRight: string;
    liveUpdateLabel: string;
    liveUpdateDesc: string;
    dynamicAvatarTitle: string;
    linePlaceholder: string;
    innerBlocksLabel: string;
    nameSuffixLabel: string;
    nameSuffixPlaceholder: string;
  };

  choiceBlock: {
    defaultOption: string;
    empty: string;
    optionPlaceholder: string;
    deleteOption: string;
    targetScene: string;
    noScene: string;
    conditionLabel: string;
    conditionPlaceholder: string;
    addOption: string;
  };

  imageBlock: {
    noAssetOption: string;
    modeLabel: string;
    modeStatic: string;
    modeBound: string;
    assetLabel: string;
    selectAsset: string;
    urlLabel: string;
    urlPlaceholder: string;
    variableLabel: string;
    selectVariable: string;
    mappingsLabel: string;
    addMapping: string;
    noMappings: string;
    matchMode: string;
    matchExact: string;
    matchRange: string;
    valueLabel: string;
    fromLabel: string;
    toLabel: string;
    fileLabel: string;
    defaultLabel: string;
    altLabel: string;
    altPlaceholder: string;
    widthLabel: string;
    widthPlaceholder: string;
  };

  videoBlock: {
    assetLabel: string;
    selectAsset: string;
    urlLabel: string;
    urlPlaceholder: string;
    widthLabel: string;
    widthPlaceholder: string;
    controls: string;
    autoplay: string;
    loop: string;
  };

  linkBlock: {
    labelField: string;
    labelPlaceholder: string;
    targetLabel: string;
    targetScene: string;
    targetBack: string;
    sceneLabel: string;
    noScene: string;
    actionsTitle: string;
    addAction: string;
    noActions: string;
    deleteAction: string;
    selectVariable: string;
    textPlaceholder: string;
    navigateTitle: string;
  };

  buttonBlock: {
    styleTitle: string;
    bgLabel: string;
    textColorLabel: string;
    borderLabel: string;
    radiusLabel: string;
    paddingLabel: string;
    fontSizeLabel: string;
    bold: string;
    fullWidth: string;
    previewTitle: string;
    defaultButtonLabel: string;
    selectVariable: string;
    textPlaceholder: string;
    deleteAction: string;
    labelField: string;
    labelPlaceholder: string;
    actionsTitle: string;
    addAction: string;
    noActions: string;
    refreshScene: string;
  };

  inputFieldBlock: {
    labelField: string;
    labelPlaceholder: string;
    variableLabel: string;
    noVariable: string;
    selectVariable: string;
    defaultNumber: string;
    defaultText: string;
    defaultNumberPlaceholder: string;
    defaultTextPlaceholder: string;
    booleanNotSupported: string;
    generated: string;
  };

  rawBlock: {
    hint: string;
  };

  dividerBlock: {
    colorLabel: string;
    thicknessLabel: string;
    thicknessSuffix: string;
    marginLabel: string;
    marginSuffix: string;
  };

  blockEffects: {
    delayLabel: string;
    delaySeconds: string;
    delaySuffix: string;
    animationLabel: string;
    animDuration: string;
    animDurationSuffix: string;
    animFadeLabel: string;
    animOffsetX: string;
    animOffsetY: string;
    animOffsetSuffix: string;
    animOffsetHint: string;
    typewriterLabel: string;
    typewriterSpeed: string;
    typewriterSpeedSuffix: string;
  };

  variableSetBlock: {
    opAssign: string;
    opAdd: string;
    opSubtract: string;
    opMultiply: string;
    opDivide: string;
    opPush: string;
    opRemove: string;
    opClear: string;
    modeManual: string;
    modeRandom: string;
    modeExpression: string;
    modeDynamic: string;
    variableLabel: string;
    noVariables: string;
    selectVariable: string;
    operationLabel: string;
    valueLabel: string;
    textPlaceholder: string;
    expressionLabel: string;
    insertVarTitle: (name: string) => string;
    controlVariable: string;
    selectControlVariable: string;
    mappingsLabel: string;
    addMapping: string;
    noMappings: string;
    matchMode: string;
    matchExact: string;
    matchRange: string;
    exactValueLabel: string;
    fromLabel: string;
    toLabel: string;
    resultLabel: string;
    defaultLabel: string;
    randomRange: string;
    randomLength: string;
    randomLengthSuffix: string;
  };

  // ─── Array accessor UI ──────────────────────────────────────────────────────
  arrayAccessor: {
    label: string;
    whole: string;
    index: string;
    length: string;
    indexLiteral: string;
    indexVariable: string;
    indexPlaceholder: string;
    selectIndexVar: string;
  };

  // ─── Checkbox block ──────────────────────────────────────────────────────────
  checkboxBlock: {
    labelField: string;
    labelPlaceholder: string;
    modeFlags: string;
    modeArray: string;
    variableLabel: string;
    selectVariable: string;
    noOptions: string;
    addOption: string;
    deleteOption: string;
    optionLabelPlaceholder: string;
    optionValuePlaceholder: string;
    optionVarPlaceholder: string;
  };

  // ─── Radio block ─────────────────────────────────────────────────────────────
  radioBlock: {
    labelField: string;
    labelPlaceholder: string;
    variableLabel: string;
    selectVariable: string;
    noOptions: string;
    addOption: string;
    deleteOption: string;
    optionLabelPlaceholder: string;
    optionValuePlaceholder: string;
  };

  // ─── Function block ───────────────────────────────────────────────────────────
  functionBlock: {
    labelField: string;
    labelPlaceholder: string;
    functionTitle: string;
    sceneLabel: string;
    noFuncScenes: string;
    actionsTitle: string;
    addAction: string;
    noActions: string;
    deleteAction: string;
    selectVariable: string;
    textPlaceholder: string;
  };

  // ─── Popup block ─────────────────────────────────────────────────────────────
  popupBlock: {
    sceneLabel:        string;
    noPopupScenes:     string;
    titleLabel:        string;
    titlePlaceholder:  string;
  };

  // ─── Shared: action type selector (ButtonBlock, LinkBlock, FunctionBlock, CellButton) ──
  actionType: {
    setVariable: string;
    openPopup:   string;
    popupScene:  string;
    popupTitle:  string;
    popupTitlePlaceholder: string;
    noPopupScenes: string;
  };

  // ─── Editor preferences modal ────────────────────────────────────────────────
  editorPrefs: {
    title: string;
    sectionAutosave: string;
    autosaveLabel: string;
    autosaveIntervalLabel: string;
    intervalMinutes: (n: number) => string;
    sectionAppearance: string;
    compactModeLabel: string;
    sectionConfirms: string;
    confirmDeleteScene: string;
    confirmDeleteGroup: string;
    confirmDeleteVariable: string;
    confirmDeleteWatcher: string;
    confirmDeleteBlock: string;
    confirmDeleteCharacter: string;
    sectionGroupDelete: string;
    deleteGroupBehaviorLabel: string;
    deleteGroupUngroup: string;
    deleteGroupWithScenes: string;
    sectionExport: string;
    confirmOpenFolderAfterExport: string;
  };

  // ─── Project settings modal ──────────────────────────────────────────────────
  projectSettings: {
    createTitle:            string;
    editTitle:              string;
    fieldTitle:             string;
    fieldTitlePlaceholder:  string;
    fieldAuthor:            string;
    fieldAuthorPlaceholder: string;
    fieldDescription:       string;
    fieldDescPlaceholder:   string;
    fieldHeaderImage:       string;
    headerImageAdd:         string;
    headerImageChange:      string;
    headerImageRemove:      string;
    sectionAppearance:      string;
    fieldBgColor:           string;
    fieldSidebarColor:      string;
    fieldTitleColor:        string;
    fieldTitleFont:         string;
    fieldTitleFontPlaceholder: string;
    sectionAdvanced:        string;
    fieldStartingScene:     string;
    fieldStartingScenePlaceholder: string;
    fieldHistoryControls:   string;
    fieldSaveLoadMenu:      string;
    create:                 string;
    save:                   string;
    chooseFolder:           string;
    titleEmpty:             string;
    headerImageNote:        string;
  };

  // ─── Scene settings modal ────────────────────────────────────────────────────
  sceneSettings: {
    title: string;
    tagsLabel: string;
    addTagPlaceholder: string;
    done: string;
  };

  // ─── Watchers ────────────────────────────────────────────────────────────────
  watchers: {
    add: string;
    empty: string;
    confirmDelete: (label: string) => string;
    defaultLabel: string;
    labelPlaceholder: string;
    enabledLabel: string;
    conditionSection: string;
    actionsSection: string;
    navigateSection: string;
    navigateNone: string;
    navigateBack: string;
    navigateScene: string;
    noVariable: string;
    addAction: string;
    unconditionalLabel: string;
    unconditionalHint: string;
  };

  insertToolbar: {
    varTitle: string;
    codeTitle: string;
    tooltipTitle: string;
    exprTitle: string;
    condTitle: string;
    linkTitle: string;
    tooltipText: string;
    tooltipContent: string;
    tooltipImage: string;
    tooltipNoImage: string;
    exprLabel: string;
    exprPlaceholder: string;
    condVariable: string;
    condValue: string;
    condIfTrue: string;
    condElse: string;
    condElseOptional: string;
    linkLabel: string;
    linkTarget: string;
    linkTargetPlaceholder: string;
    insert: string;
  };
}
