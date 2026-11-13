# Bountiful Lyrics

Immersive word-by-word lyrics and album-coloured edge glow for Spotify (Spicetify) and YouTube Music.

![Bountiful Lyrics in the Garden style](docs/preview.png)

## What's where

| You want | Ready to use | Source code |
|---|---|---|
| Spotify plugin (the one on Spicetify Marketplace) | `release/bountiful-lyrics.js` | `apps/spotify-plugin/` |
| YouTube Music extension for Chrome, Brave, Edge | `release/youtube-music-chrome/` | `apps/youtube-music-extension/` |
| YouTube Music extension for Firefox | `release/youtube-music-firefox/` | `apps/youtube-music-extension/` |
| Desktop companion window (Windows) | build it, see below | `apps/companion/` |

Everything in `release/` is built and ready; the code all three share lives in `packages/`.

## Install on Spotify

You need the Spotify desktop app (not the Microsoft Store version) with [Spicetify](https://spicetify.app).

### Step 1: install Spicetify (skip if you already have it)

Windows (PowerShell, not as administrator):

```powershell
iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex
```

macOS or Linux:

```sh
curl -fsSL https://raw.githubusercontent.com/spicetify/cli/main/install.sh | sh
```

Close and reopen the terminal afterwards so the `spicetify` command is found. Check it with `spicetify -v`.

### Step 2, option A: from Spicetify Marketplace

1. Install or update Marketplace. **You need version 1.0.12 or newer.** Older versions stop loading the extension list partway through, so new extensions like this one never show up.

   Windows (PowerShell):

   ```powershell
   iwr -useb https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.ps1 | iex
   ```

   macOS or Linux:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/spicetify/marketplace/main/resources/install.sh | sh
   ```

2. In Spotify, click the cart icon at the top, open the **Extensions** tab, set **Sort by** to **Last Updated** (or type "Bountiful" in the search box) and click the download button on the **Bountiful Lyrics** card.

### Step 2, option B: manual install

Windows (PowerShell):

```powershell
New-Item -ItemType Directory -Force "$env:APPDATA\spicetify\Extensions" | Out-Null
Invoke-WebRequest "https://raw.githubusercontent.com/Arpit-oo/bountiful-lyrics/main/release/bountiful-lyrics.js" -OutFile "$env:APPDATA\spicetify\Extensions\bountiful-lyrics.js"
spicetify config extensions bountiful-lyrics.js
spicetify apply
```

macOS or Linux:

```sh
mkdir -p "$(dirname "$(spicetify -c)")/Extensions"
curl -fsSL "https://raw.githubusercontent.com/Arpit-oo/bountiful-lyrics/main/release/bountiful-lyrics.js" -o "$(dirname "$(spicetify -c)")/Extensions/bountiful-lyrics.js"
spicetify config extensions bountiful-lyrics.js
spicetify apply
```

Spotify restarts. Open the lyrics with the star button in the playbar (bottom right, next to Spotify's own lyrics button) or press `B`; press `B` again to go back. If Spotify does not reopen, start it yourself.

Use only one of the two options. If you switch from manual to Marketplace, remove the manual copy first so it does not load twice.

### Update, remove, fix

| Task | Command |
|---|---|
| Update a manual install | run the option B commands again |
| Remove a manual install | `spicetify config extensions bountiful-lyrics.js-` then `spicetify apply` |
| Remove a Marketplace install | Marketplace → Installed tab → Bountiful Lyrics → Remove |
| It vanished after Spotify updated itself | `spicetify backup apply` |
| Something broke, start clean | `spicetify restore` then `spicetify backup apply` |
| See what is enabled | `spicetify config extensions` |

## Install on YouTube Music (browser extension)

No build needed. Get the files:

```sh
git clone https://github.com/Arpit-oo/bountiful-lyrics.git
```

or download the ZIP (green **Code** button on GitHub → **Download ZIP**) and unzip it.

- **Chrome, Brave, Edge**: open `chrome://extensions` (or `brave://extensions`, `edge://extensions`), turn on **Developer mode**, click **Load unpacked**, pick the `release/youtube-music-chrome` folder.
- **Firefox (121+)**: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, pick `release/youtube-music-firefox/manifest.json`. It lasts until Firefox restarts.

To update: `git pull` (or download the ZIP again), then click the reload icon on the extension's card.

## Develop

```
npm install
npm test
```

## Spotify plugin

Build and install your local copy:

```
npm run install:spicetify
```

Builds the extension, adds it to Spicetify and restarts Spotify. Open it with the star button next to Spotify's lyrics button, or press `B`.

Three ways to view it, switchable from the bottom bar or Settings → Open in:

- **Inside Spotify**: fills the main view like a normal page. The sidebar and playbar stay usable; navigating away closes it.
- **Fullscreen**: takes over the screen. Press `F` to toggle, `Space` to play or pause, `Esc` to close.
- **Pop-out window**: a separate always-on-top window for another monitor. Drag anywhere to move it, drag an edge or corner to resize (applied when you let go), double-click for fullscreen. It remembers its size and place and keeps animating when Spotify is minimised.

Keys while open: `B` or `Esc` close, `F` fullscreen, `P` pop-out, `I` inside Spotify, `S` settings, `1`-`4` styles, `A` album art or style backdrop, `G` glow mode, `L` hide lyrics, arrows seek and volume, `M` mute.

Styles:

- **Constellation**: each phrase becomes a star pattern on a clean black screen, one star per word, in the album's colour.
- **Garden**: lines are typed in a serif while roses (album colour) and vines (its complement) grow out of every word.
- **Fisheye**: a rolling 3D drum of words with icons and accent chips.
- **Codestyle**: lyrics typed as code.

Backgrounds: Match style, Atmospheric gradient (Garden's default), Cinematic blur, Ambient album colours, Frosted album art, Film grain, Night sky or Black. Backdrops lift softly on the beat. The cover/star button in the bottom bar flips between album art and the style's own backdrop.

Edge glow: Music Sync (default) walks light around the screen edges on the beat, like a lit monitor bezel; Breathe, Drift and Still are calmer.

Settings (gear icon) has tabs for Lyrics, Look, Colour, Edge glow and More: style cards, ten fonts (including bubbly, retro script, hand-drawn and tall poster faces), star and word size for Constellation, Tilt for Fisheye and Codestyle, colour wheels for manual colours.

Lyrics running early or late? Settings → Lyrics → Timing shifts the words by up to 1 second either way. Default is 0; the edge glow always stays on the beat.

Lyrics come from Spotify first, then LRCLIB. When neither has timing, the plain text is shown.

After Spotify updates itself, run `spicetify backup apply`.

## Desktop companion (Windows)

```
npm run build -w @bountiful/companion
apps\companion\src-tauri\target\release\bountiful-companion.exe
```

A normal app window that shows the lyrics from Spotify: drag it to any monitor, resize it, F11 or double-click for fullscreen. The bar at the bottom controls Spotify (play, pause, skip, seek, volume) and the gear opens the same settings as the plugin. Keys: Space play/pause, N/P next/previous, arrows seek and volume, S settings.

With the companion running, the plugin's pop-out button opens this window (Spotify's own pop-out is limited to half a screen on one monitor). The tray icon can also draw the glow around your whole screen, choose displays and open idle mode. Closing the window quits the app unless the screen glow is on.

## YouTube Music extension

```
npm run build -w @bountiful/ytmusic
```

Built copies are already in `release/`, so you can skip the build and load them straight away. The build refreshes them:

- **Chrome, Brave, Edge**: open `chrome://extensions` (or `brave://extensions`, `edge://extensions`), turn on Developer mode, Load unpacked, pick `release/youtube-music-chrome`.
- **Firefox (121+)**: open `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick `release/youtube-music-firefox/manifest.json`. Temporary add-ons last until Firefox restarts; a permanent install needs Mozilla signing.

On music.youtube.com press Alt+L (or the star button) to open it, Esc to go back. Inside: Q up next, S settings, 1-4 styles, F fullscreen, Space, arrows, M.

YouTube Music does not provide beat data, so the beat glow modes pulse at a calm tempo there.

## Publish to Spicetify Marketplace

Marketplace lists public GitHub repositories that have the `spicetify-extensions` topic and a valid `manifest.json` in the root. This repository already has the manifest, `docs/preview.png` and the built `release/bountiful-lyrics.js`.

To list it, add the topic once:

```
gh repo edit Arpit-oo/bountiful-lyrics --add-topic spicetify-extensions
```

Or use the gear next to About on the GitHub repository page. To remove it from Marketplace, remove the topic.

To ship a new version, rebuild the release file and push it to `main`:

```
npm run release:spicetify
git add release/bountiful-lyrics.js
git commit -m "Release plugin"
git push
```

## Layout

- `packages/core`: lyrics, timing, renderers, glow, settings UI
- `packages/protocol`: validated messages between the plugin and companion
- `apps/spotify-plugin`: Spicetify plugin for Spotify (built to `release/bountiful-lyrics.js`)
- `apps/youtube-music-extension`: browser extension (built to `release/youtube-music-chrome` and `release/youtube-music-firefox`)
- `apps/companion`: Tauri desktop window
- `release/`: built files people download; Marketplace reads `release/bountiful-lyrics.js` via `manifest.json`
