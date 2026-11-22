# Link Vault (desktop)

Save your LinkedIn, GitHub, portfolio and other links once. Press **Ctrl+Shift+L** (⌘⇧L on Mac) from any app, type a few letters, press **Enter**, and the link is on your clipboard.

## Run it

You need [Node.js](https://nodejs.org) (LTS). In this folder (the one that contains `package.json`):

```
npm install --save-dev electron electron-builder
npm start
```

The first command downloads Electron once. After that, `npm start` is all you need.

## Build an installer

```
npm run dist:win     # Windows installer (.exe), build it on Windows
npm run dist:mac     # macOS .dmg, build it on a Mac
npm run dist:linux   # Linux AppImage
```

The installer lands in `dist/`. It is not code-signed, so Windows SmartScreen or macOS Gatekeeper will warn the first time you open it.

## Using it

- **Save a link:** paste it into the top field. A preview row shows the detected name. Press **Enter** (or click the bookmark button) to save.
- **Find a link:** just type. The list filters as you go and the top match is highlighted. **↑ / ↓** move the highlight.
- **Copy / open:** **Enter** copies the highlighted link, **Ctrl+Enter** opens it in your browser. When the window was opened with the shortcut, it hides again after copying.
- **Row buttons:** copy, open in browser, pin (pinned links sort first), delete (asks twice).
- **Rename:** double-click a name.
- **Hide:** **Esc** (first press clears the search), the × in the corner, or the shortcut again. Drag the header to move the window.

## Behaviour

- **Tray:** closing the window keeps the app running in the tray so the shortcut keeps working. Right-click the tray icon for *Export links…*, *Import links…*, *Start at login* and *Quit*.
- **Storage:** links are saved to `links.json` in the app's data folder (Windows: `%APPDATA%\link-vault`, macOS: `~/Library/Application Support/link-vault`, Linux: `~/.config/link-vault`). Nothing is sent anywhere.

## Files

- `main.js` window, tray, shortcut, saving to disk
- `preload.js` the small bridge the page uses to talk to `main.js`
- `renderer/` the interface (`index.html`, `styles.css`, `app.js`)
- `build/icon.png` app and tray icon
