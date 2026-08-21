# Islamic Style (name under review — see PROJECT_CONTEXT.md)

Typography and user-defined inline styling classes for Obsidian, live in
the editor. Originally built for Arabic Islamic scholarly notes
(matn/sharh, hadith, ayah), the core mechanism is general-purpose: define
any class with your own open/close delimiters, style it, and it colors
live as you type — not just on render.

## This folder is both the repo and the installable plugin

`src/*.ts` is the real source. `main.js` at this same level is the
**bundled build output**, committed here on purpose (this is standard
practice for Obsidian plugins) so that copying this whole folder into
`.obsidian/plugins/islamic-style/` works immediately, with no build step
required just to use it.

**Never hand-edit `main.js`.** It's regenerated entirely on every build —
edit `src/*.ts` instead.

### Building after making changes

```
npm install typescript --save-dev   # or use a globally installed tsc
npm run build
```

That's it — one command. It runs `tsc` (type-checks and compiles
`src/*.ts` to `dist/*.js`), then a small bundler script combines all of
`dist/` into the single `main.js` at this folder's root, ready to reload
in Obsidian.

### Why a hand-rolled bundler instead of esbuild

Obsidian's own sample plugin template uses `esbuild`. This project
doesn't, because `esbuild` wasn't installable in the environment this was
authored in (no network access to npm). `scripts/bundle.js` is a small,
purpose-built substitute: it combines tsc's compiled CommonJS output into
one file using a minimal local module registry, leaving real npm
packages (`obsidian`, `@codemirror/*`) as genuine `require()` calls
resolved by Node/Obsidian at runtime — it doesn't try to bundle those,
only this project's own modules. If `esbuild` is available when you're
reading this, it's a fine drop-in replacement; this project just doesn't
require it.

### Type declarations

`types/obsidian.d.ts` and `types/codemirror.d.ts` are **hand-written**,
covering only the API surface this plugin actually calls — not the
official `obsidian` / `@codemirror/*` type packages, which weren't
fetchable without network access when this was authored. If you have
network access: `npm install obsidian @codemirror/view @codemirror/state
--save-dev`, delete the two files in `types/`, rebuild — should need at
most minor adjustments, since the hand-written ones were modeled closely
on documented API shapes.

## Install (no build needed to just use it)

1. Copy this whole folder into `YourVault/.obsidian/plugins/islamic-style/`
   (`src/`, `types/`, `scripts/`, `tsconfig.json`, `package.json` are
   harmless there — Obsidian only looks at `main.js`, `manifest.json`,
   `styles.css`, `data.json`).
2. Settings -> Community plugins -> reload / enable.
3. Settings -> Islamic Style.

## The core idea

A "role" is a label plus an Open and a Close delimiter, plus styling.
Wrap text between them and it gets that role's style, invisibly — the
delimiters hide unless your cursor is inside that span, exactly like `**`
around bold text.

```
{=text=}      matn        (dark red, bold)
{~text~}      تعليلات      (blue, bold)
«text»        حديث         (green, soft highlight background)
﴿text﴾        آية          (gold, bold, slightly larger)
[?text?]      سؤال         (blue, italic)
[!text!]      ملاحظة        (gray, soft highlight background)
[*text*]      هام          (red, bold, soft highlight background)
```

Presets ship seeded in but off (except matn/تعليلات) — turn on what you
want in Settings, or hit "+ Blank role" and define your own with any
Open/Close pair, color, font, size, highlight, and a raw custom-CSS field
for anything the toggles don't cover.

## Typography

Font family/size/line-height/justify/first-line-indent, content column
width, per-level (H1-H6) heading size/color/alignment/bold/underline,
per-depth list bullet shapes, footnote size — all in Settings.

## Scope

Settings -> Scope: global / cssclass-in-frontmatter / folder-include /
folder-exclude / auto-detect-Arabic-title.

## Commands

- "Wrap selection as `<role>`" — one per role, assignable to a hotkey via
  Obsidian's own Settings -> Hotkeys. Registers/unregisters live when you
  add, duplicate, or delete a role — not only at plugin startup.
- "Insert footnote" — auto-numbers, inserts the marker at your cursor,
  appends the definition at the end of the note, moves your cursor there.

## Known limitations

- A role's Open/Close can't contain a newline, and content can't cross
  one either.
- Avoid a Latin letter as the first character of a role's Open delimiter
  — it can flip an otherwise-Arabic line to render LTR. You'll get a
  Notice warning, not a hard block.
- Footnotes only get a distinct block/separator in Reading view —
  Obsidian doesn't build that structure in Live Preview at all. A
  CodeMirror widget could fake it; not built yet.
- The global typography CSS (fonts/margins/headings/bullets) follows
  whichever pane last had focus, not each split pane independently.

See `PROJECT_CONTEXT.md` for full history, every design decision and why,
the module architecture, and the live backlog.

## Nested roles

A role can contain another role — e.g. a "note" wrapping a paragraph that
has a "question" inside it. The inner role renders as a genuinely nested
`<span>` inside the outer one, so any property the inner role *doesn't*
set (color, font-family, bold, italic) falls through from the outer role
via ordinary CSS inheritance — this isn't a custom merge, it's just how
CSS already works once the DOM is properly nested. `background-color`
(highlight) correctly does *not* leak onto nested spans, since it isn't
an inherited CSS property.

**Known limitation**: nesting a role inside *itself* (a "note" inside a
"note") doesn't work correctly — plain regex matching can't distinguish
"an inner open of the same delimiter" from "my own close" without
balanced-bracket counting, which isn't implemented. Nesting *different*
roles works correctly at any depth (verified to 3 levels).

## Other new commands and settings

- **"Wrap selection with role... (search)"** — a searchable picker
  listing every role, for when you don't have a hotkey memorized for a
  specific one. The per-role commands still exist separately for hotkey
  assignment.
- **Backup / sharing** (Settings): Export copies your whole settings
  (roles/typography/scope) as JSON to the clipboard; Import pastes JSON
  back in and replaces your current settings. Doubles as a way to share a
  role pack with someone else.
- **Collision warnings**: a role whose delimiter is also native Markdown
  syntax (`**`, `` ` ``, `==`, `~~`, `#`, etc.) now gets a Notice warning
  it'll likely fight with Obsidian's own formatting for that token.

## Profiles

Multiple complete settings sets (roles + typography + scope), switched
manually — one active at a time. "Switch profile..." command, or the
dropdown at the top of Settings. Each profile can be exported/imported as
JSON independently (Settings -> Backup/sharing), so a profile is the
natural unit to share with someone else.
