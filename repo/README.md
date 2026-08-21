# Advanced Formatting

Typography and layout controls, plus a user-defined inline "dynamic
classifying" system, for Obsidian — live in the editor, not just on
render. Define any class with your own open/close delimiters, style it,
and it colors as you type — exactly like `**bold**`, but for classes you
invent yourself.

## The core idea: roles

A "role" is a label plus an Open and a Close delimiter, plus styling
(color, bold/italic/underline, font family, size, highlight, and a raw
custom-CSS field for anything the toggles don't cover). Wrap text
between them and it gets that role's style — the delimiters hide
themselves unless your cursor is inside that span, exactly like `**`
around bold text.

```
[?text?]      Question     (blue, italic)
[!text!]      Note         (gray, soft highlight background)
[*text*]      Important    (red, bold, soft highlight background)
```

The default profile ships neutral: those three example roles are seeded
in but **off** by default — turn on what you want in Settings, or hit "+
Blank role" and define your own. There's no domain-specific role set
baked into the plugin itself — a role pack for a particular use case
(e.g. Arabic scholarly notes) is just a profile (see Profiles below).

A role can contain another role — e.g. a "note" wrapping a paragraph
that has a "question" inside it. The inner role renders as a genuinely
nested `<span>`, so any property the inner role *doesn't* set falls
through from the outer role via ordinary CSS inheritance.
**Known limitation**: nesting a role inside *itself* doesn't work
correctly (plain regex can't tell "an inner open" from "my own close"
without balanced-bracket counting). Different roles nest correctly at
any depth.

## Format selection — formatting without defining a role first

"Format selection..." (command palette, hotkey, or right-click on a
selection) opens a panel: pick color/bold/italic/underline/font/size/
highlight for exactly the selected text, no named role needed. Every
toggle applies **immediately** — no separate "Apply" step, except for
Custom CSS (its own "Apply CSS" button, deliberately not live-on-
keystroke, so a half-typed CSS declaration doesn't reformat the
document). "Cancel" reverts everything back to exactly what was there
before the panel opened. Font family offers a dropdown of bundled
fonts (work immediately, no installation — see Fonts below) and common
fonts (need to already be installed on your system) plus a "Custom..."
freeform option. Custom CSS also has a "Snippets..." popup for
quick-picking a saved fragment (see CSS Snippets below) instead of
retyping it.

Behind the scenes it creates a small, invisible, auto-generated role
just for that span. Re-running it on already-formatted text pre-fills
from what's actually there and **replaces** that formatting rather than
stacking a second layer on top.

"Clear formatting" (command palette, hotkey, or right-click) strips
whatever role-based formatting is at your cursor/selection.

## Fonts — bundled (no install) vs. common (must be installed)

Font pickers throughout the plugin (Format selection, the role editor)
group choices into two kinds:

- **Bundled**: Amiri, Scheherazade New, and Noto Naskh Arabic ship
  *inside the plugin itself* as font files — pick one and it just
  works, nothing to install. All three are open-license (SIL Open Font
  License) Arabic-script faces suited to scholarly/Quranic text; their
  license files are in `fonts/<name>/OFL.txt`.
- **Common**: everyday fonts (Georgia, Times New Roman, etc.) that
  usually come with an OS, but aren't bundled — only render correctly
  if that exact font is actually installed on your system. If it's
  missing, the field silently falls back to the next font in the
  stack; there's no error shown.
- **Custom...**: type any other exact, already-installed font name
  (e.g. an Uthmanic Quran font like "KFGQPC HAFS Uthmanic Script") —
  same "must be installed first" rule as Common fonts.

## CSS Snippets

Settings -> CSS Snippets: named, reusable Custom CSS fragments (a
starter set — wide letter spacing, small caps, a subtle text shadow —
is included, all editable/removable). Pick one from the "Snippets..."
button next to any Custom CSS field (Format selection, the role
editor) instead of retyping it.

## Colorize — one-click color, no dialog

Right-click a selection, or just right-click a plain word with nothing
selected, for a "Colorize" quick menu: a palette of colors you declare
in Settings (add/edit/remove swatches under "Quick colors" — each shown
with an actual colored swatch and a readable name like "Red", not just
a hex code), plus an always-available "Custom..." picker. Merges into
whatever formatting is already there (bold, underline, etc.) rather
than replacing it outright — colorizing underlined text keeps the
underline. Uses the same underlying mechanism as Format selection —
just skips the dialog for the common case of "I just want this one
color, right now."

## Text direction — forcing RTL/LTR on one line

Right-click a paragraph, heading, or blockquote line (or the "Force
right-to-left" / "Force left-to-right" / "Clear direction override"
commands) to override that line's direction — independent of whatever
direction the rest of the note resolves to. **Not offered for list
lines** — forcing direction there was found to visibly break the
list's own formatting (likely `direction: rtl/ltr` conflicting with
Obsidian's own bullet-position CSS), so it's intentionally scoped out
rather than left half-working; "Clear" still works on a list line, for
removing a stale marker from before this exclusion existed.

## Heading alignment/bold — per-heading, not per-level

Right-click a heading for "Align left/center/right/auto" and
"Bold: on/off/auto", all **per that specific heading** — changing one
H2's alignment does *not* affect any other H2 in the note. ("Auto"
clears the override, falling back to whatever that heading level's
own style in Settings currently is — which is unaffected by any of
this, still the shared default every heading of that level uses
unless individually overridden here.) Direction, alignment, and bold
overrides can all be set independently on the same heading at once.

**Bullet shape's right-click quick-switch is still the OLD kind of
shortcut** — it edits that nesting depth's shared setting in Settings
directly (so changing one list item's bullet changes every item at
that depth), the same bug alignment/bold used to have before this
round. Not yet converted to a per-instance override; a real, known
limitation, not an oversight.

## Inline roles — styling the delimiters themselves

A role set to always show its delimiters (Settings -> that role ->
Delimiter display -> Show) can also apply its own color/font/size to
the delimiter characters, not just the content between them — toggle
"Style the delimiters too" on that role. Off by default (delimiters
stay in the plain default tag appearance).

## Typography

Font family/size/line-height/**paragraph spacing** (separate from line
height — the gap *between* paragraphs, not within one — applies to
every line you press Enter on, not only blank-line-separated
paragraphs)/justify/first-line-indent, content column width, per-depth
list bullet shapes, footnote size — all in Settings, per-profile.

Per-level (H1-H6) heading styling has its own gear-icon editor (same
depth as a role's): size, alignment, color, bold, underline, font
family, and Custom CSS with the same "Snippets..." popup Format
selection and roles get. For a one-off override on a single specific
heading rather than every heading of that level, use the right-click
menu instead (see Text direction / heading alignment above).

## Footnotes

"Insert footnote" auto-numbers, inserts the marker at your cursor,
appends the definition at the end of the note, and moves your cursor
there. Renders with a real separator/block in both Live Preview and
Reading view.

## Scope

Settings -> Scope: global / cssclass-in-frontmatter / folder-include /
folder-exclude / auto-detect-Arabic-title. Controls which notes any of
this applies to at all.

## Profiles

Multiple complete settings sets (roles + typography + scope), switched
manually — one active at a time. "Switch profile..." command, or the
dropdown at the top of Settings. Each profile can be exported/imported
as JSON independently (Settings -> Backup/sharing) — import always
**appends** a new profile, never overwrites an existing one — so a
profile is the natural unit to share with someone else.

**Islamic/Arabic profile**: not shipped by default. "+ Add Islamic/
Arabic profile" in Settings (or the "Add Islamic/Arabic profile"
command) adds a ready-made profile with matn/تعليلات/حديث/آية roles for
Arabic scholarly notes. Once added it's an ordinary profile — deletable
the same way any other profile is, nothing special-cased about it.

## Commands

- "Format selection...", "Clear formatting" — see above.
- "Force right-to-left (current line)", "Force left-to-right (current
  line)", "Clear direction override (current line)" — see Text
  direction above.
- "Wrap selection as `<role>`" — one per role, assignable to a hotkey.
  Registers/unregisters live as you add, duplicate, or delete a role.
- "Wrap selection with role... (search)" — a searchable picker across
  every role, for when you don't have a specific hotkey memorized.
- "Insert footnote" — see Footnotes above.
- "Switch profile...", "Add Islamic/Arabic profile" — see Profiles
  above.

## Known limitations / unverified

Real-Obsidian testing has confirmed the core roles/typography/profile
system works well. The following are either known limitations or
recent fixes not yet re-confirmed by hand in a live vault (this repo
was built and typechecked here, but not run inside actual Obsidian) —
if something in this list is still broken when you test it, it's the
first place to look, and `PROJECT_CONTEXT.md` has the detailed
reasoning and code pointers for each:

- A role's Open/Close can't contain a newline, and content can't cross
  one either.
- Nesting a role inside itself (see above).
- The cursor-barrier fix (crossing a hidden delimiter in one arrow
  press, not many) and the bidi-mirroring fix (delimiters on non-Arabic
  text rendering the right way round) — both fixed at the code level
  this round, not yet re-tested by hand.
- Paragraph spacing in Live Preview is a best-effort approximation
  (there's no real "paragraph" boundary in CM6's line-based model, only
  blank-line detection) — Reading view's version is exact.
- The right-click "quick switch bullet style" detects list nesting
  depth from leading whitespace as a heuristic (assumes 4-space/tab
  indents), not a real list-structure parse.
- Footnotes only get a distinct block/separator built by this plugin in
  Reading view — Obsidian doesn't build that structure in Live Preview
  at all. Handled with a CodeMirror widget here; not yet confirmed by
  hand.
- The global typography CSS (fonts/margins/headings/bullets) follows
  whichever pane last had focus, not each split pane independently.

See `PROJECT_CONTEXT.md` for full history, every design decision and
why, the module architecture, and the live backlog.

## Suggested screen recordings

If you're putting this on the community plugin list or just want quick
reference clips for yourself, these are the moments that are genuinely
hard to describe in words but obvious in five seconds of video:

1. **Typing through a role's hidden delimiters** — place the cursor
   inside an already-formatted span and watch the delimiters reveal
   themselves, then move out and watch them vanish again.
2. **Format selection end-to-end** — select some plain text, run
   "Format selection...", pick a color/size, confirm, show the result;
   then re-run it on the same span to show it replacing (not stacking)
   the formatting.
3. **Right-click menu** — one clip showing Format selection, Clear
   formatting, direction toggle, and the heading/bullet quick-switches
   all from the same context menu.
4. **RTL/LTR override on one paragraph inside an otherwise
   opposite-direction note** — the clearest possible demo of why this
   feature exists.
5. **Switching profiles** — same note, instant visual change as you
   switch from a plain profile to the Islamic/Arabic one (or back).
6. **Nested roles** — a "note" role wrapping a paragraph with a
   "question" role inside it, showing the inner span correctly
   inheriting the outer's styling.
7. **Export/import a profile as JSON** — copy from one vault, paste
   into another, show it landing as a new profile without touching the
   existing one.

## This folder is both the repo and the installable plugin

`src/*.ts` is the real source. `main.js` at this same level is the
**bundled build output**, committed here on purpose (this is standard
practice for Obsidian plugins) so that copying this whole folder into
`.obsidian/plugins/advanced-formatting/` works immediately, with no build step
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
originally authored in. `scripts/bundle.js` is a small, purpose-built
substitute: it combines tsc's compiled CommonJS output into one file
using a minimal local module registry, leaving real npm packages
(`obsidian`, `@codemirror/*`) as genuine `require()` calls resolved by
Node/Obsidian at runtime — it doesn't try to bundle those, only this
project's own modules. If `esbuild` is available when you're reading
this, it's a fine drop-in replacement; this project just doesn't require
it.

### Type declarations

`types/obsidian.d.ts` and `types/codemirror.d.ts` are **hand-written**,
covering only the API surface this plugin actually calls. As of this
round they've been spot-checked against the real published `obsidian`,
`@codemirror/view`, and `@codemirror/state` npm packages wherever new
API surface was added (`Editor.getLine`/`setLine`, `Menu`/`MenuItem`
including `setChecked`, `Decoration.line`, `EditorView.dispatch`/
`domEventHandlers`, `EditorState.sliceDoc`, `EditorSelection.main`,
`SelectionRange.empty`) — not a full migration to the real packages as
devDependencies, just verified-correct hand-written stubs. If you have
network access and want the real packages instead: `npm install
obsidian @codemirror/view @codemirror/state --save-dev`, delete the two
files in `types/`, rebuild — should need at most minor adjustments.

## Install (no build needed to just use it)

1. Copy this whole folder into `YourVault/.obsidian/plugins/advanced-formatting/`
   — **`fonts/` is required now** (the bundled Amiri/Scheherazade New/
   Noto Naskh Arabic fonts live there; without it those font options
   just won't render). `src/`, `types/`, `scripts/`, `tsconfig.json`,
   `package.json` are harmless there but unused at runtime — Obsidian
   only looks at `main.js`, `manifest.json`, `styles.css`, `fonts/`,
   `data.json`.
2. Settings -> Community plugins -> reload / enable.
3. Settings -> Advanced Formatting.

