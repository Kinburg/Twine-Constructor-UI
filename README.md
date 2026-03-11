# Twine Constructor

A visual editor for building interactive stories with [SugarCube 2](https://www.motoslave.net/sugarcube/2/), exporting to `.twee` format.

## Features

### Scene Editor
- **Content blocks**: text, character dialogue, choice (branching), condition (IF/ELSE IF/ELSE), variable set, image, video, button, input field, HTML table, raw SugarCube code, note
- **Drag-and-drop** sorting for blocks and scenes
- **Nested blocks** inside condition branches
- **Search** by text and variable usage — click results to navigate to the scene and block
- **Undo / Redo** (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), 100-step history

### Project Management
- Characters with avatars
- Variables (number, string, boolean) with types and default values
- Media assets (images, video) with variable bindings
- Sidebar panel (StoryCaption) — visual cell editor: text, variable, progress bar, image, raw code
- Export to `.twee` / `.zip`

### Tools
- **Scene graph** — interactive transition map with drag-and-drop nodes (separate window)
- **Code preview** — live-updating `.twee` output for the active scene (separate window)
- UI available in **English and Russian**

## Installation

Download the latest release from the [Releases](../../releases) page:

- `TwineConstructor-Setup-x.x.x.exe` — installer with custom install directory
- `TwineConstructor-x.x.x-win.zip` — portable version

## Development

```bash
# Install dependencies
npm install

# Start in development mode (Electron + Vite HMR)
npm run dev

# Build installer
npm run dist
```

**Requirements:** Node.js 20+

## Stack

| Layer | Technologies |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS 4 |
| State | Zustand 5 |
| Desktop | Electron 40, vite-plugin-electron |
| Build | Vite 7, esbuild |
| Graph | @xyflow/react, @dagrejs/dagre |
| Packaging | electron-builder (NSIS + ZIP) |

## Releasing

```bash
npm version patch   # 1.0.0 → 1.0.1  (or minor / major)
git push && git push --tags
```

GitHub Actions will automatically build the installer and create a Release with artifacts.

## License

MIT
