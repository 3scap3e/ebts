# ebts

Event builder and simulator. Desktop app, Rust core, CLI.

## Download

Installers for macOS, Windows and Linux are on the Releases page of this repository.

The macOS app is not notarized yet. If the first launch is blocked, open System Settings → Privacy & Security and choose Open Anyway, or run:

```bash
xattr -dr com.apple.quarantine /Applications/ebts.app
```

## Private files

Prompts, provider settings, API keys and working files never enter a project's shareable files: they live in `local/`, `providers.json`, `~/.config/ebts/` and `generation.log`, all excluded by the `.gitignore` every project is created with.

## Development

```bash
cd apps/desktop && npm install
```

```bash
cd apps/desktop && npm run wasm
```

```bash
cd apps/desktop && npm run app
```

Releases are built by `.github/workflows/release.yml` when a `v*` tag is pushed.
