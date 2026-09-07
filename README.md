# Advanced Formatting

Typography and user-defined inline formatting roles for Obsidian, live in the editor — with strong support for Arabic/RTL text.

Define your own inline "roles" (like `«hadith»`, `[?question?]`, or `{=matn=}`) with their own color, font, size, and delimiters, and see them styled live as you type — no need to switch to Reading view. Roles, typography, and scope are bundled into switchable **profiles**, so you can keep separate visual setups (academic notes, Arabic scholarly notes, fiction, etc.) in the same vault.

## Features

### Inline roles
- Wrap text in a role's own delimiters to style it — delimiters can be any string, not just symmetric pairs (`«…»`, `[?…?]`, `{=…=}`, etc.).
- Each role has its own color, font family, size, bold/italic/underline, background highlight, and an escape-hatch custom CSS field.
- Delimiters can display as **auto** (hidden unless the cursor is inside), **always shown**, **always hidden**, or replaced with a custom **alias** (like a wikilink alias).
- Roles can nest inside one another; an inner role inherits any style it doesn't set itself.
- Every enabled role is also its own command, so you can bind it to a hotkey (**Settings → Hotkeys**, search "Wrap selection as").

### Direct (one-off) formatting
- **Format selection...** — a Word-style dialog for formatting just the current selection (bold, italic, underline, color, background, font, size, custom CSS) without creating a named role.
- **Colorize** (right-click menu) — a fast, one-click color-only path using your profile's quick-color palette, plus a custom color option.
- **Clear formatting** — strips whatever formatting (role or native bold/italic) is at the cursor.

### Text direction & headings
- Force a paragraph, heading, or blockquote to right-to-left or left-to-right regardless of its content (not supported on list lines).
- Right-click a heading to override just *that heading's* alignment or bold weight, without changing every other heading of the same level.

### Typography
- Body font (including three bundled, zero-install Arabic fonts — Amiri, Noto Naskh Arabic, and Scheherazade New — plus any font already installed on your system), size, line height, paragraph spacing, justification, first-line indent, and content column width.
- Per-level heading styles (H1–H6): size, color, alignment, bold, underline, font, custom CSS.
- Nested list bullet shapes (circle, square, diamond) per depth.
- Footnotes with automatic numbering, matching Obsidian's own Reading-view numbering order, with an Arabic-Indic numeral option.

### Profiles
- Bundle a full set of roles, typography, and scope rules into a named, switchable profile — for example, one profile for English notes and another for Arabic scholarly notes.
- An optional, ready-made **Islamic / Arabic Scholarly** profile (matn, تعليلات, حديث, آية) can be added from Settings or the "Add Islamic/Arabic profile" command — it's not included by default.
- Export/import a single profile as JSON to back it up or share it.
- Choose where a profile applies: every note, notes with a specific `cssclass`, specific folders (included or excluded), or automatically for notes whose title starts in Arabic.

### Settings language
- The settings pane itself can display in English or Arabic (**Settings → Advanced Formatting → Settings language**) — this only affects the settings UI, never your notes.

## Commands

| Command | What it does |
|---|---|
| Wrap selection with role... (search) | Searchable picker to wrap the current selection with any role |
| Format selection... | Live one-off formatting dialog for the current selection |
| Clear formatting | Removes formatting at the cursor |
| Force right-to-left / left-to-right (current line) | Overrides direction for the current line(s) |
| Clear direction override (current line) | Removes a direction override |
| Add Islamic/Arabic profile | Adds the ready-made Islamic/Arabic Scholarly profile |
| Switch profile... | Switches which profile is active |
| Insert footnote | Inserts a new auto-numbered footnote reference + definition |
| Strip Advanced Formatting markup (this note) | Removes all of this plugin's own markup from the current note, leaving the plain text |
| Strip Advanced Formatting markup (entire vault) | Same, across every note in the vault (confirmation required) |

Right-clicking in the editor also surfaces Format selection, Clear formatting, Colorize, direction overrides, and (on a heading or list line) quick style-switching, where applicable.

## Uninstalling

Because roles are just plain, readable delimiter characters in your Markdown (not proprietary binary formatting), your notes stay readable even without the plugin. If you'd like your notes to look clean before disabling or removing it, run **Strip Advanced Formatting markup** (current note or entire vault) first — this is a manual step, since Obsidian gives plugins no reliable way to run cleanup automatically on uninstall.

## Known limitations

- A role can't currently nest inside another instance of *itself* — nesting *different* roles works at any depth.
- Formatting commands (wrap, clear, direct formatting) operate within a single line; a selection spanning multiple paragraphs isn't supported.
- Forcing text direction is not supported on list lines, since it conflicts with how Obsidian positions list bullets.
- The right-click bullet-shape quick-switch changes the shared per-depth setting for the whole profile, not just the one list item clicked (unlike the heading alignment/bold quick-switch, which is per-instance).

## License

MIT — see [LICENSE](./LICENSE).

Bundled fonts (Amiri, Noto Naskh Arabic, Scheherazade New) are each licensed separately under the SIL Open Font License; see the `OFL.txt` file alongside each font in `fonts/`.
