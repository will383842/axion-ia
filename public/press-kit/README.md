# Press kit assets

Public download targets for the press room (`/presse` FR · `/press` EN).

## Phase 1 — current state

All assets are intentionally absent. The press kit cards display a disabled
"Coming soon" UI when the corresponding `fileUrl` is `null` in
`src/content/press.ts`. This avoids fabricated downloads and keeps the
page honest while binaries are prepared.

## Phase 2 — assets to drop here

Filenames are referenced from `src/content/press.ts`. Update the matching
`fileUrl` from `null` to the new public path (e.g. `/press-kit/logo-axionia.svg`).

| id                | suggested filename                | format |
| ----------------- | --------------------------------- | ------ |
| `logo-primary`    | `logo-axionia.svg`                | SVG    |
| `logo-monochrome` | `logo-axionia-mono.svg`           | SVG    |
| `wordmark-dark`   | `wordmark-axionia-dark.png`       | PNG    |
| `brand-book`      | `axionia-brand-book.pdf`          | PDF    |
| `founder-photo`   | `axionia-founder-portrait.jpg`    | JPG    |
| `boilerplate`     | `axionia-boilerplate-fr-en.txt`   | TXT    |
