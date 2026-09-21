# Advanced Formatting

Global typography and readable inline formatting for Obsidian, with support for Arabic and RTL text.

## Inline formatting

One-off formatting uses readable markup:

```text
~={orange}colored text=~
~={color:orange; bg:#fff3cd; font:Amiri; size:1.1; bold}formatted text=~
```

Simple bold and italic remain native Markdown. Reusable global roles use the same syntax with a role name:

```text
~={role:hadith}text=~
```

Roles are edited in Settings and applied from the `Apply inline role...` command. Formatting is supported in Live Preview and Reading view.

## Editor context menu

Right-clicking selected text opens Obsidian's editor context menu. It includes:

- quick colors from Settings;
- `Format selection...`;
- `Apply inline role...`;
- `Clear formatting`;
- direction and heading/list shortcuts where applicable.

The Format selection control is a small anchored popover, not a full modal window.

## Settings

Settings are global and organized into:

- Typography;
- Headings;
- Lists;
- Quick colors;
- Inline roles;
- Advanced CSS snippets.

Font choices include common installed fonts and custom font names. The plugin does not download or install fonts automatically.

### Custom CSS snippets

Custom CSS snippets are reusable CSS declarations for an inline role. Enter declarations without a selector or braces; the plugin inserts them into the formatted span. For example:

```css
letter-spacing: 0.05em;
font-variant: small-caps;
text-shadow: 0 1px 2px #0004;
border-bottom: 1px solid currentColor;
```

Name each snippet so it can be recognized later, then choose it from the “Snippets...” button in a role editor. CSS snippets are not used by the compact Format selection popover.

## Commands

| Command | What it does |
|---|---|
| Apply inline role... | Applies a reusable global role to the selection |
| Format selection... | Opens the compact formatting popover |
| Clear formatting | Removes plugin formatting at the selection/cursor |
| Force right-to-left / left-to-right | Overrides the current line direction |
| Clear direction override | Removes a direction override |
| Strip formatting from this note | Removes known plugin markup from the current note |

The vault-wide strip command, footnote insertion command, profile system, and profile-specific commands are intentionally not part of this pre-release design.

## Limitations

- Formatting actions currently operate within one line.
- Direction overrides are supported on list lines with list-specific marker isolation. Because Obsidian and themes render list markers differently, verify numbered and nested lists in both Live Preview and Reading view after changing a list's direction.
- The new syntax is intentionally simple and does not support arbitrary nested direct-format spans.

## License

MIT — see [LICENSE](./LICENSE).
