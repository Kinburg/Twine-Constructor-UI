// ── Block types data ──────────────────────────────────────────
window.PURL_BLOCKS = [
  {
    id: 'text', kind: 'text', name_en: 'Text', name_uk: 'Текст',
    desc_en: 'Text paragraph with SugarCube markup support. Live mode for auto-refresh when variables change. Typewriter effect available.',
    desc_uk: 'Абзац тексту з підтримкою розмітки SugarCube. Live-режим для автоматичного оновлення при зміні змінних. Є ефект друкарської машинки.',
    tags: ['markup', 'live', 'typewriter'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="26" height="2.5" rx="1.25" fill="var(--accent)"/><rect x="3" y="13" width="20" height="2.5" rx="1.25" fill="var(--accent)" opacity=".7"/><rect x="3" y="19" width="24" height="2.5" rx="1.25" fill="var(--accent)" opacity=".7"/><rect x="3" y="25" width="14" height="2.5" rx="1.25" fill="var(--accent)" opacity=".45"/></svg>`
  },
  {
    id: 'dialogue', kind: 'text', name_en: 'Dialogue', name_uk: 'Діалог',
    desc_en: 'Character speech bubble with avatar, name and color styling. Supports alignment, nested blocks and typewriter effect.',
    desc_uk: 'Репліка персонажа з аватаром, ім\'ям та кольоровим оформленням. Підтримує вирівнювання, вкладені блоки та ефект друкарської машинки.',
    tags: ['avatar', 'nested', 'color'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 6 Q2 3 5 3 H27 Q30 3 30 6 V17 Q30 20 27 20 H15 L8 27 L9 20 H5 Q2 20 2 17 Z" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".12"/><rect x="8" y="9" width="12" height="2" rx="1" fill="var(--accent)" opacity=".85"/><rect x="8" y="13.5" width="8" height="2" rx="1" fill="var(--accent)" opacity=".55"/></svg>`
  },
  {
    id: 'choice', kind: 'flow', name_en: 'Choice', name_uk: 'Вибір',
    desc_en: 'Branching menu that lets the player pick a destination scene. Each option can have a visibility condition.',
    desc_uk: 'Меню варіантів для переходу між сценами. Кожен варіант може мати умову відображення.',
    tags: ['branch', 'condition'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="10" r="2.2" fill="var(--accent)"/><rect x="10" y="8.5" width="17" height="2.5" rx="1.25" fill="var(--accent)" opacity=".8"/><circle cx="5" cy="18" r="2.2" fill="var(--accent)" opacity=".55"/><rect x="10" y="16.5" width="13" height="2.5" rx="1.25" fill="var(--accent)" opacity=".55"/><circle cx="5" cy="26" r="2.2" fill="var(--accent)" opacity=".3"/><rect x="10" y="24.5" width="15" height="2.5" rx="1.25" fill="var(--accent)" opacity=".3"/><path d="M26 9 L29 10 L26 11" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'condition', kind: 'flow', name_en: 'Condition (IF)', name_uk: 'Умова (IF)',
    desc_en: 'if / else-if / else branches with nested block support. Handles numeric range checks and array operations.',
    desc_uk: 'Гілки if / else-if / else з підтримкою вкладених блоків будь-якого типу. Підтримує числові діапазони та операції з масивами.',
    tags: ['logic', 'nested'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 2 L30 16 L16 30 L2 16 Z" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".12"/><path d="M16 30 L10 34" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><path d="M16 30 L22 34" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><rect x="11" y="13.5" width="4" height="2" rx="1" fill="var(--accent)" opacity=".9"/><rect x="11" y="17.5" width="4" height="2" rx="1" fill="var(--accent)" opacity=".6"/><rect x="17" y="13.5" width="5" height="2" rx="1" fill="var(--accent)" opacity=".4"/><rect x="17" y="17.5" width="5" height="2" rx="1" fill="var(--accent)" opacity=".25"/></svg>`
  },
  {
    id: 'set', kind: 'logic', name_en: 'Set variable', name_uk: 'Встановити змінну',
    desc_en: 'Assigns a value to a variable: manually, randomly, via expression, or by mapping another variable. Supports array operations (push, remove, clear).',
    desc_uk: 'Задає значення змінній: вручну, випадково, через вираз або за значенням іншої змінної. Підтримує операції з масивами (push, remove, clear).',
    tags: ['expression', 'random', 'array'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="8" width="11" height="11" rx="2.5" stroke="var(--accent)" stroke-width="1.7" fill="var(--accent)" fill-opacity=".12"/><path d="M7.5 11.5 C6 11.5 6 14 7.5 14 C9 14 9 16.5 7.5 16.5" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/><path d="M7.5 10.5 L7.5 11.5 M7.5 16.5 L7.5 17.5" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/><path d="M15 13.5 L19 13.5 M17.5 11.5 L20 13.5 L17.5 15.5" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><rect x="21" y="8" width="9" height="11" rx="2.5" fill="var(--accent)" fill-opacity=".22" stroke="var(--accent)" stroke-width="1.7"/><rect x="23.5" y="12" width="4" height="1.5" rx=".75" fill="var(--accent)"/><rect x="23.5" y="15" width="4" height="1.5" rx=".75" fill="var(--accent)" opacity=".6"/></svg>`
  },
  {
    id: 'image', kind: 'media', name_en: 'Image', name_uk: 'Зображення',
    desc_en: 'Static image by URL or asset path. In bound mode the image switches based on a variable\'s value.',
    desc_uk: 'Статичне зображення за URL або шляхом до ресурсу. У режимі прив\'язки зображення змінюється залежно від значення змінної.',
    tags: ['static', 'bound'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="5" width="28" height="22" rx="3" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".08"/><circle cx="10" cy="12" r="2.5" fill="var(--accent)" opacity=".55"/><path d="M2 23 L9 15 L15 21 L20 16 L30 23" stroke="var(--accent)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="var(--accent)" fill-opacity=".18"/></svg>`
  },
  {
    id: 'video', kind: 'media', name_en: 'Video', name_uk: 'Відео',
    desc_en: 'Embedded video with configurable autoplay, loop and player controls.',
    desc_uk: 'Вбудоване відео з налаштуваннями автовідтворення, повтору та відображення елементів керування.',
    tags: ['autoplay', 'loop'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="6" width="28" height="20" rx="3" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".08"/><path d="M13 11 L23 16 L13 21 Z" fill="var(--accent)" opacity=".75"/><rect x="2" y="6" width="28" height="4" rx="3" fill="var(--accent)" fill-opacity=".15"/><circle cx="7" cy="8" r="1" fill="var(--accent)" opacity=".6"/><circle cx="11" cy="8" r="1" fill="var(--accent)" opacity=".4"/><circle cx="15" cy="8" r="1" fill="var(--accent)" opacity=".25"/></svg>`
  },
  {
    id: 'audio', kind: 'media', name_en: 'Audio', name_uk: 'Аудіо',
    desc_en: 'Background music or sound effect. Immediate or delayed playback, loop, volume, stop-on-leave or persist as a global track. Can silence all other sounds before playing.',
    desc_uk: 'Фонова музика або звуковий ефект. Миттєве або відкладене відтворення, цикл, гучність, зупинка при виході зі сцени або продовження як глобальний трек.',
    tags: ['bgm', 'sfx'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 12 H10 L18 5 V27 L10 20 H5 Z" stroke="var(--accent)" stroke-width="1.6" fill="var(--accent)" fill-opacity=".18"/><path d="M21.5 10 C25 12.5 25 19.5 21.5 22" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M24.5 7 C30 10.5 30 21.5 24.5 25" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".5"/></svg>`
  },
  {
    id: 'button', kind: 'flow', name_en: 'Button', name_uk: 'Кнопка',
    desc_en: 'Styled button that mutates variables without navigating. Can trigger a full scene refresh after the click.',
    desc_uk: 'Стилізована кнопка, що змінює змінні без переходу між сценами. Може оновити поточну сцену після натискання.',
    tags: ['action', 'inline'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="10" width="26" height="12" rx="6" fill="var(--accent)" fill-opacity=".18" stroke="var(--accent)" stroke-width="1.8"/><rect x="9" y="14.5" width="14" height="2.5" rx="1.25" fill="var(--accent)" opacity=".75"/><path d="M5 22 Q3 28 8 30" stroke="var(--accent)" stroke-width="1.4" stroke-linecap="round" opacity=".3"/></svg>`
  },
  {
    id: 'link', kind: 'flow', name_en: 'Link', name_uk: 'Посилання',
    desc_en: 'Styled navigation button that goes to another scene or back. Can mutate variables before navigating.',
    desc_uk: 'Стилізована кнопка для переходу в іншу сцену або повернення назад. Може змінювати змінні перед переходом.',
    tags: ['inline', 'jump'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="10" width="20" height="12" rx="6" fill="var(--accent)" fill-opacity=".15" stroke="var(--accent)" stroke-width="1.8"/><rect x="7" y="14.5" width="9" height="2.5" rx="1.25" fill="var(--accent)" opacity=".7"/><path d="M24 16 H31" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/><path d="M27.5 12.5 L31.5 16 L27.5 19.5" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  {
    id: 'input', kind: 'ui', name_en: 'Input field', name_uk: 'Поле вводу',
    desc_en: 'Text or number input that saves the player\'s entry to a variable. Supports writing to an array element by index.',
    desc_uk: 'Текстове або числове поле, що зберігає введене гравцем значення у змінну. Підтримує запис в елемент масиву.',
    tags: ['text', 'number', 'variable'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="9" width="28" height="14" rx="3" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".07"/><rect x="7" y="14" width="11" height="2" rx="1" fill="var(--accent)" opacity=".55"/><rect x="18" y="12.5" width="1.8" height="5" rx=".9" fill="var(--accent)" opacity=".9"/><path d="M5 9 L5 6" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" opacity=".45"/><path d="M27 9 L27 6" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" opacity=".45"/></svg>`
  },
  {
    id: 'checkbox', kind: 'ui', name_en: 'Checkbox', name_uk: 'Прапорці',
    desc_en: 'Checkbox group in two modes: each checkbox controls its own boolean variable, or all together manage a single array.',
    desc_uk: 'Група прапорців у двох режимах: кожен прапорець керує окремою булевою змінною, або всі разом — одним масивом.',
    tags: ['boolean', 'array'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="11" height="11" rx="2" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".15"/><path d="M6 10.5 L8.5 13 L14 7.5" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="20" width="11" height="11" rx="2" stroke="var(--accent)" stroke-width="1.8" fill="none" opacity=".45"/><rect x="18" y="8" width="11" height="2.5" rx="1.25" fill="var(--accent)" opacity=".7"/><rect x="18" y="23" width="9" height="2.5" rx="1.25" fill="var(--accent)" opacity=".35"/></svg>`
  },
  {
    id: 'radio', kind: 'ui', name_en: 'Radio', name_uk: 'Перемикачі',
    desc_en: 'Radio button group that sets a string variable to the selected option\'s value. Exactly one option is always chosen.',
    desc_uk: 'Група перемикачів, що задає рядкову змінну значенням обраного варіанту. Рівно один варіант завжди обраний.',
    tags: ['string', 'variable'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="10" r="5.5" stroke="var(--accent)" stroke-width="1.8"/><circle cx="9" cy="10" r="2.5" fill="var(--accent)"/><circle cx="9" cy="24" r="5.5" stroke="var(--accent)" stroke-width="1.8" opacity=".4"/><rect x="18" y="7.5" width="11" height="2.5" rx="1.25" fill="var(--accent)" opacity=".75"/><rect x="18" y="21.5" width="9" height="2.5" rx="1.25" fill="var(--accent)" opacity=".35"/></svg>`
  },
  {
    id: 'table', kind: 'ui', name_en: 'Table', name_uk: 'Таблиця',
    desc_en: 'Grid of cells containing text, variables, progress bars, images and buttons. Ideal for stats panels or inventory displays.',
    desc_uk: 'Сітка клітинок з текстом, змінними, прогрес-барами, зображеннями та кнопками. Ідеальна для панелей статистики чи інвентарю.',
    tags: ['grid', 'stats'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="3" width="28" height="26" rx="2.5" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".07"/><rect x="2" y="3" width="28" height="7" rx="2.5" fill="var(--accent)" fill-opacity=".2"/><path d="M2 17 H30" stroke="var(--accent)" stroke-width="1.3" opacity=".5"/><path d="M2 24 H30" stroke="var(--accent)" stroke-width="1.3" opacity=".5"/><path d="M12 10 V29" stroke="var(--accent)" stroke-width="1.3" opacity=".5"/><path d="M22 10 V29" stroke="var(--accent)" stroke-width="1.3" opacity=".5"/></svg>`
  },
  {
    id: 'hr', kind: 'ui', name_en: 'Divider', name_uk: 'Роздільник',
    desc_en: 'Horizontal rule with configurable color, thickness and vertical margin.',
    desc_uk: 'Горизонтальна лінія з налаштуванням кольору, товщини та вертикальних відступів.',
    tags: ['layout'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="7" width="20" height="2" rx="1" fill="var(--accent)" opacity=".3"/><rect x="3" y="11.5" width="14" height="2" rx="1" fill="var(--accent)" opacity=".2"/><rect x="2" y="17" width="28" height="2.5" rx="1.25" fill="var(--accent)"/><rect x="3" y="22.5" width="18" height="2" rx="1" fill="var(--accent)" opacity=".3"/><rect x="3" y="27" width="12" height="2" rx="1" fill="var(--accent)" opacity=".2"/></svg>`
  },
  {
    id: 'include', kind: 'system', name_en: 'Include', name_uk: 'Включення сцени',
    desc_en: 'Inserts another scene\'s content via <<include>>. Supports a styled wrapper with size, border and background options.',
    desc_uk: 'Вставляє вміст іншої сцени через <<include>>. Підтримує обгортку з налаштуванням розміру, рамки та фону.',
    tags: ['reuse', 'embed'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="4" width="28" height="24" rx="3" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".07"/><rect x="7" y="9" width="18" height="14" rx="2" stroke="var(--accent)" stroke-width="1.5" fill="var(--accent)" fill-opacity=".14"/><rect x="10" y="13" width="8" height="1.8" rx=".9" fill="var(--accent)" opacity=".65"/><rect x="10" y="17" width="6" height="1.8" rx=".9" fill="var(--accent)" opacity=".4"/><path d="M2 4 L7 9" stroke="var(--accent)" stroke-width="1.3" opacity=".35"/><path d="M30 4 L25 9" stroke="var(--accent)" stroke-width="1.3" opacity=".35"/></svg>`
  },
  {
    id: 'function', kind: 'logic', name_en: 'Function', name_uk: 'Виклик функції',
    desc_en: 'Executes a function-tagged scene without navigating — variables update, player stays in place. Great for reusable logic.',
    desc_uk: 'Виконує сцену-функцію без переходу — змінні оновлюються, але гравець залишається на місці. Зручно для повторюваної логіки.',
    tags: ['reuse', 'args'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="13" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".1"/><path d="M19 7 C15 7 13 10 13 13 V26" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round"/><path d="M9 16.5 H18" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/></svg>`
  },
  {
    id: 'popup', kind: 'ui', name_en: 'Popup', name_uk: 'Спливаюче вікно',
    desc_en: 'Opens a SugarCube Dialog modal when the passage renders. Content comes from a scene tagged "popup". Buttons can open popups too.',
    desc_uk: 'Відкриває модальне вікно SugarCube Dialog при рендері пасажу. Вміст береться зі сцени з тегом «popup». Кнопки також можуть відкривати попапи.',
    tags: ['modal', 'dialog'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="23" height="19" rx="2.5" fill="var(--accent)" fill-opacity=".06" stroke="var(--accent)" stroke-width="1.3" opacity=".35"/><rect x="8" y="10" width="23" height="19" rx="3" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".12"/><rect x="8" y="10" width="23" height="6" rx="3" fill="var(--accent)" fill-opacity=".28"/><rect x="8" y="13" width="23" height="3" fill="var(--accent)" fill-opacity=".28"/><circle cx="27" cy="13" r="1.6" fill="var(--accent)" opacity=".75"/><rect x="12" y="20" width="11" height="2" rx="1" fill="var(--accent)" opacity=".65"/><rect x="12" y="24" width="8" height="2" rx="1" fill="var(--accent)" opacity=".4"/></svg>`
  },
  {
    id: 'raw', kind: 'system', name_en: 'Raw Code', name_uk: 'Сирий код',
    desc_en: 'Inserts arbitrary SugarCube macros or HTML verbatim into the exported passage, without any transformation.',
    desc_uk: 'Вставляє довільні макроси SugarCube або HTML безпосередньо в експортований пасаж, без жодних перетворень.',
    tags: ['sugarcube', 'html', 'escape-hatch'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 9 L3 16 L10 23" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 9 L29 16 L22 23" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6.5 L13 25.5" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round" opacity=".65"/></svg>`
  },
  {
    id: 'note', kind: 'system', name_en: 'Note', name_uk: 'Нотатка',
    desc_en: 'Developer comment visible only in the editor, never exported. Useful for inline annotations and logic notes.',
    desc_uk: 'Коментар розробника, видимий лише в редакторі, не потрапляє в експорт. Зручний для позначок та пояснень логіки.',
    tags: ['comment', 'editor-only'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4 H22 L28 10 V30 H4 Z" stroke="var(--accent)" stroke-width="1.8" fill="var(--accent)" fill-opacity=".08"/><path d="M22 4 L22 10 H28" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><rect x="8" y="15" width="13" height="2" rx="1" fill="var(--accent)" opacity=".6"/><rect x="8" y="20" width="10" height="2" rx="1" fill="var(--accent)" opacity=".45"/><rect x="8" y="25" width="12" height="2" rx="1" fill="var(--accent)" opacity=".3"/><circle cx="10" cy="9" r="2" fill="var(--accent)" opacity=".4"/></svg>`
  },
  {
    id: 'inventory', kind: 'world', name_en: 'Inventory', name_uk: 'Інвентар',
    desc_en: 'Displays a character\'s inventory in the scene. Supports picking up, dropping, equipping and transferring items between containers.',
    desc_uk: 'Відображає інвентар персонажа в сцені. Підтримує підбір, видачу, екіпірування та передачу предметів між контейнерами.',
    tags: ['equip', 'transfer'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="6" width="24" height="20" rx="2.5" stroke="var(--accent)" stroke-width="1.7" fill="var(--accent)" fill-opacity=".08"/><rect x="8" y="11" width="7" height="5" rx="1" fill="var(--accent)" opacity=".5"/><rect x="8" y="18" width="7" height="5" rx="1" fill="var(--accent)" opacity=".35"/><rect x="17" y="11" width="7" height="5" rx="1" fill="var(--accent)" opacity=".3"/><rect x="17" y="18" width="7" height="5" rx="1" fill="var(--accent)" opacity=".2"/><path d="M8 8 H24" stroke="var(--accent)" stroke-width="1.2" opacity=".4"/></svg>`
  },
  {
    id: 'inv-shortcut', kind: 'world', name_en: 'Inventory Shortcut', name_uk: 'Ярлик інвентарю',
    desc_en: 'A shortcut button that opens an inventory popup. Handy for the sidebar or any scene that needs quick inventory access.',
    desc_uk: 'Кнопка-ярлик для швидкого відкриття інвентарю у вигляді попапу. Зручна для бокової панелі або будь-якої сцени.',
    tags: ['popup', 'sidebar'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="10" width="18" height="12" rx="6" fill="var(--accent)" fill-opacity=".18" stroke="var(--accent)" stroke-width="1.8"/><rect x="7" y="14.5" width="8" height="2.5" rx="1.25" fill="var(--accent)" opacity=".75"/><rect x="20" y="8" width="10" height="16" rx="3" stroke="var(--accent)" stroke-width="1.4" fill="var(--accent)" fill-opacity=".08"/><rect x="22" y="12" width="6" height="3" rx="1" fill="var(--accent)" opacity=".4"/><rect x="22" y="17" width="6" height="3" rx="1" fill="var(--accent)" opacity=".25"/></svg>`
  },
  {
    id: 'paperdoll', kind: 'world', name_en: 'Paperdoll', name_uk: 'Папердол',
    desc_en: 'Equipment display with body part slots. Body images change based on character stats (strength, dexterity, etc.), and item appearance changes based on item variables (upgrade level, kill count, etc.).',
    desc_uk: 'Візуальний дисплей екіпірування зі слотами для частин тіла. Зображення частин тіла змінюються залежно від характеристик персонажа (сила, спритність, тощо), а вигляд айтемів — від їхніх змінних (рівень прокачки, лічильник вбивств, тощо).',
    tags: ['slots', 'dynamic', 'stats'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><ellipse cx="16" cy="9" rx="4.5" ry="5.5" stroke="var(--accent)" stroke-width="1.6" fill="var(--accent)" fill-opacity=".12"/><path d="M8 28 C8 21 24 21 24 28" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" fill="none"/><rect x="10" y="15" width="4" height="5" rx="1" fill="var(--accent)" opacity=".4"/><rect x="18" y="15" width="4" height="5" rx="1" fill="var(--accent)" opacity=".4"/><circle cx="16" cy="17" r="1.5" fill="var(--accent)" opacity=".6"/></svg>`
  },
  {
    id: 'container', kind: 'world', name_en: 'Container', name_uk: 'Контейнер',
    desc_en: 'Displays the contents of a container — chest, shop or loot bag. The player can pick up and place items. Contents are stored in a character or scene variable.',
    desc_uk: 'Відображає вміст контейнера — скрині, магазину або лут-мішка. Гравець може брати та класти предмети. Вміст зберігається у змінній персонажа або сцени.',
    tags: ['shop', 'loot', 'chest'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="10" width="26" height="18" rx="2.5" stroke="var(--accent)" stroke-width="1.7" fill="var(--accent)" fill-opacity=".08"/><path d="M3 15 H29" stroke="var(--accent)" stroke-width="1.3" opacity=".4"/><rect x="11" y="4" width="10" height="6" rx="2" stroke="var(--accent)" stroke-width="1.5" fill="var(--accent)" fill-opacity=".15"/><rect x="7" y="19" width="5" height="5" rx="1" fill="var(--accent)" opacity=".45"/><rect x="14" y="19" width="5" height="5" rx="1" fill="var(--accent)" opacity=".3"/><rect x="21" y="19" width="5" height="5" rx="1" fill="var(--accent)" opacity=".2"/></svg>`
  },
  {
    id: 'plugin', kind: 'system', name_en: 'Custom Blocks (Plugins)', name_uk: 'Власні блоки (Плагіни)',
    desc_en: 'A constructor for custom parameterised blocks. Compose a plugin from any existing blocks, define its parameters (text, number, variable, scene, colour) — and reuse it across any scene. Plugins can be exported and imported as standalone files.',
    desc_uk: 'Конструктор власних блоків із параметрами. Збирайте плагін з будь-яких існуючих блоків, налаштовуйте параметри (текст, число, змінна, сцена, колір) — і повторно використовуйте його в будь-якій сцені. Плагіни експортуються та імпортуються як окремі файли.',
    tags: ['composable', 'export'],
    svg: `<svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="10" width="20" height="18" rx="2.5" stroke="var(--accent)" stroke-width="1.7" fill="var(--accent)" fill-opacity=".1"/><rect x="10" y="4" width="4" height="8" rx="1" fill="var(--accent)" fill-opacity=".5" stroke="var(--accent)" stroke-width="1.3"/><rect x="18" y="4" width="4" height="8" rx="1" fill="var(--accent)" fill-opacity=".5" stroke="var(--accent)" stroke-width="1.3"/><rect x="2" y="16" width="6" height="4" rx="1" fill="var(--accent)" fill-opacity=".4" stroke="var(--accent)" stroke-width="1.3"/><rect x="24" y="16" width="6" height="4" rx="1" fill="var(--accent)" fill-opacity=".4" stroke="var(--accent)" stroke-width="1.3"/><circle cx="16" cy="19" r="2.5" fill="var(--accent)" opacity=".65"/></svg>`
  }
];

window.PURL_BLOCK_KINDS = {
  text:   { en: 'TEXT',    uk: 'ТЕКСТ' },
  flow:   { en: 'FLOW',    uk: 'ПОТІК' },
  logic:  { en: 'LOGIC',   uk: 'ЛОГІКА' },
  media:  { en: 'MEDIA',   uk: 'МЕДІА' },
  world:  { en: 'WORLD',   uk: 'СВІТ' },
  ui:     { en: 'UI',      uk: 'UI' },
  system: { en: 'SYSTEM',  uk: 'СИСТЕМА' }
};
