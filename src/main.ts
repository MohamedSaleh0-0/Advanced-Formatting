import { Editor, EditorPosition, Notice, Plugin } from "obsidian";
import { AdvancedFormattingSettings, Role, ListBulletShape } from "./types";
import { DEFAULT_TYPOGRAPHY, DEFAULT_QUICK_COLORS, DEFAULT_CSS_SNIPPETS, defaultRoles, defaultSettings, mergeTypography } from "./defaults";
import { buildRoleRegexes, unwrapDirectFormatting, findEnclosingRoleMatch } from "./delimiters";
import { clearFormattingAtRange } from "./clearFormatting";
import { validateRoles } from "./validation";
import { createFormattingViewPlugin, isCmAvailable } from "./decorations";
import { registerReadingModeProcessor } from "./readingMode";
import { buildStylesheet } from "./stylesheet";
import { AdvancedFormattingSettingTab } from "./settingsTab";
import { RolePickerModal } from "./rolePicker";
import { FormatSelectionModal } from "./formatSelectionModal";
import { CustomColorModal } from "./customColorModal";
import { colorLabel } from "./colorNames";
import { defaultDirectFormatOptions, detectBareBoldItalic, DirectFormatOptions } from "./directFormat";
import { buildDirectSyntaxMarkup, findDirectMatches, findRoleSyntaxMatches, unwrapReadableSyntax } from "./directSyntax";
import { LineDirection, detectLineDirection, setLineDirection } from "./direction";
import { AlignOverride, BoldOverride, detectAlignOverride, setAlignOverride, detectBoldOverride, setBoldOverride } from "./headingOverrides";
import { detectHeadingKey, detectListDepth } from "./lineContext";
import { collectAllDelimiterPairs, stripDelimitersFromText } from "./stripFormatting";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
	return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

class AdvancedFormattingPlugin extends Plugin {
	settings!: AdvancedFormattingSettings;
	private generatedStyleSheet!: CSSStyleSheet;

	async onload(): Promise<void> {
		await this.loadSettings();
		validateRoles(this.settings.roles);

		this.generatedStyleSheet = new CSSStyleSheet();
		const documentWithAdoptedSheets = document as Document & { adoptedStyleSheets: CSSStyleSheet[] };
		documentWithAdoptedSheets.adoptedStyleSheets = [
			...(documentWithAdoptedSheets.adoptedStyleSheets || []),
			this.generatedStyleSheet,
		];
		this.applyStylesheet();

		document.body.classList.add("af-formatting-active");

		if (isCmAvailable()) {
			this.registerEditorExtension(createFormattingViewPlugin(this));
		} else {
			new Notice("Advanced Formatting: live-preview coloring unavailable; Reading view works.");
		}

		registerReadingModeProcessor(this);
		this.addSettingTab(new AdvancedFormattingSettingTab(this.app, this));

		this.addCommand({
			id: "wrap-with-role-search",
			name: "Apply inline role...",
			editorCallback: (editor: Editor) => {
				new RolePickerModal(this.app, this.settings.roles, editor).open();
			},
		});

		// One-off formatting is written directly into readable markup; it
		// never creates a role or command entry.
		this.addCommand({
			id: "format-selection",
			name: "Format selection...",
			editorCallback: (editor: Editor) => this.openFormatSelectionModal(editor),
		});

		// Clear formatting — the counterpart "Format selection..." was
		// missing entirely. Deliberately position-based rather than
		// working off the selected TEXT: a role's delimiters in "hide"
		// mode (which is what direct-formatting always uses) are invisible
		// to mouse/click selection, so a user dragging across the visibly
		// formatted word never actually selects the delimiter characters —
		// there'd be nothing in editor.getSelection() to strip. Reading
		// the cursor's line/ch position and re-deriving matches from the
		// raw line (clearFormatting.ts, same matcher decorations.ts
		// already uses) works regardless of how the selection was made.
		// Ordinary Ctrl+Z still undoes the original formatting action too —
		// this is an explicit, deliberate "remove formatting here" action,
		// not a replacement for undo.
		this.addCommand({
			id: "clear-formatting",
			name: "Clear formatting",
			editorCallback: (editor: Editor) => this.runClearFormatting(editor),
		});

		this.addCommand({
			id: "force-rtl-line",
			name: "Force right-to-left (current line)",
			editorCallback: (editor: Editor) => this.runSetLineDirection(editor, "rtl"),
		});
		this.addCommand({
			id: "force-ltr-line",
			name: "Force left-to-right (current line)",
			editorCallback: (editor: Editor) => this.runSetLineDirection(editor, "ltr"),
		});
		this.addCommand({
			id: "clear-direction-line",
			name: "Clear direction override (current line)",
			editorCallback: (editor: Editor) => this.runSetLineDirection(editor, null),
		});

		// Right-click access to both, not just command palette/hotkey —
		// requested explicitly. Format selection only makes sense with an
		// active selection; Clear formatting is offered whenever the
		// cursor's on a line at all (it Notices if nothing formatted is
		// actually there, same as invoking it via hotkey with nothing to
		// clear).
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				// Capture the range before the context menu closes; Obsidian can
				// clear the editor selection while the menu action is dispatched.
				const selectedRange = editor.getSelection()
					? { from: editor.getCursor("from"), to: editor.getCursor("to") }
					: null;

				if (selectedRange) {
					menu.addItem((item) =>
						item
							.setTitle("Format selection...")
							.setIcon("paintbrush")
							.onClick(() => window.setTimeout(() => {
								editor.setSelection(selectedRange.from, selectedRange.to);
								this.openFormatSelectionModal(editor);
							}, 0))
					);
				}
				menu.addItem((item) =>
					item
						.setTitle("Clear formatting")
						.setIcon("eraser")
						.onClick(() => this.runClearFormatting(editor))
				);

				// Colorize — a fast, color-only path via the quick-color
				// palette declared in Settings (profile.quickColors), plus
				// always a "Custom..." option, for when the full Format
				// selection dialog is more than you need. Works off an
				// explicit selection, or — the common case this was asked
				// for — a bare right-click on a word with nothing
				// selected, via getWordRangeAtCursor below.
				const colorizeRange = selectedRange || this.getWordRangeAtCursor(editor);
				if (colorizeRange) {
					menu.addSeparator();
					const quickColors = Array.isArray(this.settings.quickColors) && this.settings.quickColors.length
						? this.settings.quickColors
						: DEFAULT_QUICK_COLORS;
					for (const color of quickColors) {
						menu.addItem((item) =>
							item
								// Plain text is intentional: older Obsidian menu
								// implementations can abort the whole menu when given a
								// DocumentFragment title.
								.setTitle(this.colorMenuTitle(color))
								.setIcon("paintbrush")
								.onClick(async () => {
									editor.setSelection(colorizeRange.from, colorizeRange.to);
									await this.runColorize(editor, color);
								})
						);
					}
					menu.addItem((item) =>
						item
							.setTitle("🎨 Custom color...")
							.setIcon("palette")
							.onClick(() => {
								editor.setSelection(colorizeRange.from, colorizeRange.to);
								new CustomColorModal(this.app, (color) => {
									void this.runColorize(editor, color);
								}).open();
							})
					);
				}

				// Direction override applies to whichever line(s) the
				// cursor/selection touches — a heading, a paragraph, a list
				// item, doesn't matter, it's a per-line property regardless
				// of what kind of line it is (direction.ts).
				//
				// EXCEPT list lines: forcing direction there was reported
				// to visibly break the list's own formatting, twice, even
				// after fixing the marker-position bug that explained the
				// first report (see PROJECT_CONTEXT.md). The remaining
				// likely cause — `direction: rtl/ltr` interacting badly
				// with Obsidian's own bullet-position CSS, which this
				// plugin doesn't control and can't verify without a live
				// instance — isn't something to keep guess-fixing a third
				// time. Scoped out for list lines specifically rather than
				// removing the whole feature, since it works for
				// paragraphs/headings/blockquotes. "Clear" is still always
				// offered, so a stale marker from before this exclusion
				// can still be removed from a list line.
				const curLineText = editor.getLine(editor.getCursor("from").line);
				const curDir = detectLineDirection(curLineText);
				const curLineIsList = !!detectListDepth(curLineText);
				if (!curLineIsList) {
					menu.addItem((item) =>
						item
							.setTitle("Force right-to-left")
							.setIcon("align-right")
							.setChecked(curDir === "rtl")
							.onClick(() => this.runSetLineDirection(editor, "rtl"))
					);
					menu.addItem((item) =>
						item
							.setTitle("Force left-to-right")
							.setIcon("align-left")
							.setChecked(curDir === "ltr")
							.onClick(() => this.runSetLineDirection(editor, "ltr"))
					);
				}
				if (curDir) {
					menu.addItem((item) =>
						item
							.setTitle("Clear direction override")
							.setIcon("x")
							.onClick(() => this.runSetLineDirection(editor, null))
					);
				}

				// Heading-style quick switch — only offered when the
				// cursor's actually on a heading line. Sets a PER-LINE
				// override (headingOverrides.ts) rather than editing that
				// H-level's shared config in Settings — this used to
				// mutate typography.headings[key] directly, which meant
				// changing ONE heading's alignment/bold visibly changed
				// EVERY heading of that level, reported as a bug. "Auto"
				// clears the override, reverting to whatever the level's
				// own Settings-configured style currently is — that
				// shared style is still exactly what Settings edits, this
				// menu just no longer writes to it.
				const headingKey = detectHeadingKey(curLineText);
				if (headingKey) {
					const curAlign = detectAlignOverride(curLineText);
					const aligns: { label: string; value: AlignOverride; icon: string }[] = [
						{ label: "Align left (this heading)", value: "left", icon: "align-left" },
						{ label: "Align center (this heading)", value: "center", icon: "align-center" },
						{ label: "Align right (this heading)", value: "right", icon: "align-right" },
						{ label: "Align auto (this heading)", value: null, icon: "align-justify" },
					];
					for (const a of aligns) {
						menu.addItem((item) =>
							item
								.setTitle(headingKey.toUpperCase() + ": " + a.label)
								.setIcon(a.icon)
								.setChecked(curAlign === a.value)
								.onClick(() => {
									const ln = editor.getCursor("from").line;
									editor.setLine(ln, setAlignOverride(editor.getLine(ln), a.value));
								})
						);
					}
					const curBold = detectBoldOverride(curLineText);
					const bolds: { label: string; value: BoldOverride }[] = [
						{ label: "Bold: on (this heading)", value: "on" },
						{ label: "Bold: off (this heading)", value: "off" },
						{ label: "Bold: auto (this heading)", value: null },
					];
					for (const b of bolds) {
						menu.addItem((item) =>
							item
								.setTitle(headingKey.toUpperCase() + ": " + b.label)
								.setIcon("bold")
								.setChecked(curBold === b.value)
								.onClick(() => {
									const ln = editor.getCursor("from").line;
									editor.setLine(ln, setBoldOverride(editor.getLine(ln), b.value));
								})
						);
					}
				}

				// Bullet-style quick switch — same "shortcut to the global
				// per-depth setting" reasoning as heading-style above.
				// detectListDepth is a heuristic (see lineContext.ts) —
				// good enough to point at the right depth in the common
				// case, not a real list-structure parser.
				const listDepth = detectListDepth(curLineText);
				if (listDepth) {
					const profile = this.settings;
					const shapes: ListBulletShape[] = ["circle", "square", "diamond"];
					const idx = listDepth - 1;
					for (const shape of shapes) {
						menu.addItem((item) =>
							item
								.setTitle("Bullet (level " + listDepth + "): " + shape)
								.setIcon("list")
								.setChecked(profile.typography.listBulletShapes[idx] === shape)
								.onClick(() => {
									while (profile.typography.listBulletShapes.length <= idx) {
										profile.typography.listBulletShapes.push("circle");
									}
									profile.typography.listBulletShapes[idx] = shape;
									void this.saveAndApply();
								})
						);
					}
				}
			})
		);

		// The manual "get back to plain Markdown before you disable or
		// uninstall this plugin" escape hatch — see README's Uninstalling
		// section. There's deliberately no automatic version: Obsidian
		// gives plugins no reliable hook for "about to be uninstalled"
		// (onunload fires on disable, not necessarily on the file deletion
		// that IS an uninstall, and isn't guaranteed to fire on app close
		// either) — so this can only ever be something the user runs
		// themselves, ahead of time, not something the plugin does for
		// them on the way out.
		this.addCommand({
			id: "strip-formatting-current-note",
			name: "Strip formatting from this note",
			editorCallback: (editor: Editor) => this.runStripFormattingCurrentNote(editor),
		});
	}

	onunload(): void {
		if (this.generatedStyleSheet) {
			const documentWithAdoptedSheets = document as Document & { adoptedStyleSheets: CSSStyleSheet[] };
			documentWithAdoptedSheets.adoptedStyleSheets = documentWithAdoptedSheets.adoptedStyleSheets.filter(
				(sheet) => sheet !== this.generatedStyleSheet
			);
		}
		document.body.classList.remove("af-formatting-active");
	}

	// Context-menu helpers. Emoji squares make the palette scannable even
	// when the menu is narrow or configured colors are visually similar.
	// Right-clicking a plain word with nothing selected is the common case
	// "Colorize" was asked for — Obsidian's editor-menu doesn't auto-
	// select the word under a right-click the way some editors do, so
	// this expands outward from the cursor position over Unicode
	// letters/digits/underscore (covers Arabic script too, not just
	// ASCII word characters) to find the word's real boundaries. Returns
	// null if the cursor isn't actually touching a word (e.g. it's on
	// whitespace or punctuation).
	colorMenuTitle(hex: string): string {
		const label = colorLabel(hex);
		const emoji: Record<string, string> = {
			red: "🟥", yellow: "🟨", green: "🟩", blue: "🟦", orange: "🟧",
			brown: "🟫", pink: "🩷", grape: "🟪", violet: "🟪", indigo: "🟦",
			gray: "⬜", black: "⬛", white: "⬜",
		};
		return (emoji[label.toLowerCase()] || "🎨") + " " + label;
	}

	getWordRangeAtCursor(editor: Editor): { from: EditorPosition; to: EditorPosition } | null {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		const isWordChar = (ch: string) => /[\p{L}\p{N}_]/u.test(ch);
		let start = cursor.ch;
		let end = cursor.ch;
		while (start > 0 && isWordChar(line[start - 1])) start--;
		while (end < line.length && isWordChar(line[end])) end++;
		if (start === end) return null;
		return { from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end } };
	}

	// Figures out the REAL span to replace for a re-format/re-wrap
	// operation, the clean (un-formatted) text inside it, and — new this
	// round — whatever formatting is ALREADY there, so callers can
	// pre-fill a dialog with it or merge into it instead of discarding it.
	// See findEnclosingRoleMatch in delimiters.ts for why this is more
	// than just "use the current selection": a visually-reselected
	// already-formatted word's selection now correctly EXCLUDES the
	// hidden delimiters flanking it (since the atomic-ranges fix), so
	// replacing only the selection would leave the old delimiters behind
	// as orphaned, undecorated raw characters. This looks for an existing
	// role match that CONTAINS the selection and, if found, uses that
	// match's real boundaries instead — then detectExistingFormatAroundRole
	// (directFormat.ts) reads the role's own properties back out AND
	// checks for native **bold**/*italic* immediately outside it (those
	// live outside the role entirely, see buildDirectFormatMarkup), and
	// grows the range to cover that too. detectBareBoldItalic covers the
	// separate case of bold/italic with no role at all (no color/etc, so
	// no role was ever created for it).
	//
	// Only does any of this detection for a single-line selection — role
	// matches can't cross a line (see delimiters.ts), so there's nothing
	// to look up for a multi-line one; it falls back to the plain
	// selection + unwrapDirectFormatting on the selection text (which
	// still helps if the selection happens to include stray delimiter
	// fragments, just doesn't grow the range or detect existing options).
	resolveFormattingTarget(
		editor: Editor
	): { from: EditorPosition; to: EditorPosition; clean: string; raw: string; existingOpts: DirectFormatOptions | null } | null {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		const rawSel = editor.getSelection();
		if (!rawSel) return null;
		const roles = this.settings.roles;
		if (from.line === to.line) {
			const lineText = editor.getLine(from.line);
			const formattedMatches = [...findDirectMatches(lineText), ...findRoleSyntaxMatches(lineText, roles)];
			const overlappingMatches = formattedMatches.filter((m) => m.matchStart < to.ch && m.matchEnd > from.ch);
			if (overlappingMatches.length) {
				// Live Preview selections cover the visible content, while
				// CodeMirror's atomic decorations hide the delimiters around
				// it. Expand to every overlapping raw match so replacing a
				// larger selection removes those hidden delimiters too instead
				// of leaving them behind as nested/orphaned syntax.
				let expandedFrom = from.ch;
				let expandedTo = to.ch;
				for (const match of overlappingMatches) {
					expandedFrom = Math.min(expandedFrom, match.matchStart);
					expandedTo = Math.max(expandedTo, match.matchEnd);
				}
				const expandedRaw = lineText.slice(expandedFrom, expandedTo);
				const clean = unwrapReadableSyntax(unwrapDirectFormatting(expandedRaw, roles), roles);
				const singleEnclosing = overlappingMatches.length === 1 &&
					overlappingMatches[0].matchStart <= from.ch && overlappingMatches[0].matchEnd >= to.ch;
				return {
					from: { line: from.line, ch: expandedFrom },
					to: { line: from.line, ch: expandedTo },
					clean,
					raw: expandedRaw,
					existingOpts: singleEnclosing ? overlappingMatches[0].opts : null,
				};
			}
			const enclosing = findEnclosingRoleMatch(lineText, from.ch, to.ch, roles);
			if (enclosing) {
				return {
					from: { line: from.line, ch: enclosing.matchStart },
					to: { line: from.line, ch: enclosing.matchEnd },
					clean: lineText.slice(enclosing.contentStart, enclosing.contentEnd),
					raw: lineText.slice(enclosing.matchStart, enclosing.matchEnd),
					existingOpts: {
						bold: enclosing.role.bold,
						italic: enclosing.role.italic,
						underline: enclosing.role.underline,
						color: enclosing.role.color || "",
						backgroundColor: enclosing.role.highlightColor || "",
						fontFamily: enclosing.role.fontFamily || "",
						sizeEm: enclosing.role.sizeEm,
						customCss: enclosing.role.customCss || "",
					},
				};
			}
			const bare = detectBareBoldItalic(lineText, from.ch, to.ch);
			if (bare) {
				const span = lineText.slice(bare.from, bare.to);
				return {
					from: { line: from.line, ch: bare.from },
					to: { line: from.line, ch: bare.to },
					clean: unwrapDirectFormatting(span, roles),
					raw: span,
					existingOpts: bare.opts,
				};
			}
		}
		return { from, to, clean: unwrapReadableSyntax(unwrapDirectFormatting(rawSel, roles), roles), raw: rawSel, existingOpts: null };
	}

	private hydrateSettings(rawSettings: unknown): AdvancedFormattingSettings {
		const p = asRecord(rawSettings);
		const typography = mergeTypography(p.typography);
		if (!typography.listBulletShapes || !typography.listBulletShapes.length) {
			typography.listBulletShapes = DEFAULT_TYPOGRAPHY.listBulletShapes.slice();
		}
		// "hollow-circle" was removed (confirmed broken in real Obsidian —
		// its CSS `list-style-type: circle` reading-view fallback never
		// actually rendered hollow) — migrate any note that had it saved
		// to "circle" rather than leaving a dangling value the dropdown/
		// stylesheet no longer recognizes.
		typography.listBulletShapes = typography.listBulletShapes.map((s: string) =>
			s === "hollow-circle" ? "circle" : s
		) as typeof typography.listBulletShapes;
		const quickColors = Array.isArray(p.quickColors) && p.quickColors.length
			? (p.quickColors as string[])
			: DEFAULT_QUICK_COLORS.slice();
		const cssSnippets = Array.isArray(p.cssSnippets)
			? p.cssSnippets.filter((s): s is { name: string; css: string } => {
				if (!s || typeof s !== "object") return false;
				const record = s as Record<string, unknown>;
				return typeof record.name === "string" && typeof record.css === "string";
			})
			: DEFAULT_CSS_SNIPPETS.map((s) => Object.assign({}, s));

		return {
			roles: Array.isArray(p.roles) && p.roles.length ? (p.roles as Role[]) : defaultRoles(),
			typography,
			quickColors,
			cssSnippets,
			uiLanguage: p.uiLanguage === "ar" ? "ar" : "en",
		};
	}

	async loadSettings(): Promise<void> {
		const data = asRecord(await this.loadData());
		// Pre-release schema: only the new global top-level shape is loaded.
		this.settings = data.roles || data.typography || data.quickColors || data.cssSnippets ? this.hydrateSettings(data) : defaultSettings();
	}

	// One-click color-only formatting — the right-click "Colorize" menu
	// (below) and its quick-color palette. Deliberately reuses the exact
	// same resolveFormattingTarget pipeline as Format selection/wrap-as-
	// role, rather than a simpler "just replaceSelection" shortcut — that
	// simpler path is exactly what produced the "double formatting ->
	// gibberish" bug this round (see findEnclosingRoleMatch in
	// delimiters.ts), and re-colorizing an already-colored word is a
	// completely ordinary way to hit that same case again.
	async runColorize(editor: Editor, color: string): Promise<void> {
		const target = this.resolveFormattingTarget(editor);
		if (!target) {
			new Notice("Advanced Formatting: select some text first.");
			return;
		}
		// Start from whatever's already there (bold/underline/font/etc.)
		// and only override color — NOT a blank slate. Colorize is meant
		// to be a fast "just change the color" action, not "replace all
		// formatting with color only."
		const opts = Object.assign({}, target.existingOpts || defaultDirectFormatOptions(), { color });
		editor.replaceRange(buildDirectSyntaxMarkup(target.clean, opts), target.from, target.to);
	}

	openFormatSelectionModal(editor: Editor): void {
		const target = this.resolveFormattingTarget(editor);
		if (!target) {
			new Notice("Advanced Formatting: select some text first.");
			return;
		}
		const sel = target.clean;
		let currentFrom = target.from;
		let currentTo = target.to;
		const apply = (opts: DirectFormatOptions) => {
			const markup = buildDirectSyntaxMarkup(sel, opts);
			editor.replaceRange(markup, currentFrom, currentTo);
			currentTo = { line: currentFrom.line, ch: currentFrom.ch + markup.length };
		};

		const cancel = () => {
			editor.replaceRange(target.raw, currentFrom, currentTo);
		};

		new FormatSelectionModal(this.app, sel, apply, cancel, target.existingOpts || undefined, this.settings.quickColors).open();
	}

	runClearFormatting(editor: Editor): void {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		if (from.line !== to.line) {
			new Notice("Advanced Formatting: clearing formatting across multiple lines isn't supported — select within one line.");
			return;
		}
		const line = editor.getLine(from.line);
		const direct = [...findDirectMatches(line), ...findRoleSyntaxMatches(line, this.settings.roles)].find((m) => m.matchStart <= from.ch && m.matchEnd >= to.ch);
		if (direct) {
			editor.replaceRange(line.slice(direct.contentStart, direct.contentEnd), { line: from.line, ch: direct.matchStart }, { line: from.line, ch: direct.matchEnd });
			editor.setSelection({ line: from.line, ch: direct.matchStart }, { line: from.line, ch: direct.matchStart + direct.contentEnd - direct.contentStart });
			return;
		}
		const roleRegexes = buildRoleRegexes(this.settings.roles);
		const result = clearFormattingAtRange(line, from.ch, to.ch, roleRegexes);
		if (!result) {
			new Notice("Advanced Formatting: no formatting found there.");
			return;
		}
		editor.setLine(from.line, result.newLine);
		editor.setSelection({ line: from.line, ch: result.newFrom }, { line: from.line, ch: result.newTo });
	}

	// Applies to every line the current selection touches (a heading or a
	// single-line paragraph is the common case, but a multi-line
	// quote/list selection reasonably means "flip all of these") — not
	// just the cursor's own line. Skips list lines when SETTING a
	// direction (see the editor-menu handler above for why), but always
	// allows CLEARING one, so a stale marker on a list line from before
	// this exclusion existed can still be removed.
	runSetLineDirection(editor: Editor, dir: LineDirection): void {
		const from = editor.getCursor("from").line;
		const to = editor.getCursor("to").line;
		let changed = 0;
		for (let ln = from; ln <= to; ln++) {
			const text = editor.getLine(ln);
			if (dir !== null && detectListDepth(text)) continue;
			editor.setLine(ln, setLineDirection(text, dir));
			changed++;
		}
		if (!changed && dir !== null) {
			new Notice("Advanced Formatting: forcing direction on a list line isn't supported (it broke the list's own formatting) — try it on a paragraph or heading instead.");
		}
	}

	// Removes every delimiter pair this plugin's roles (named or
	// hidden/ephemeral, any profile, enabled or not) could have written
	// into THIS note, plus the bidi-isolate wrapper wrapWithDelims adds
	// around each one (see stripFormatting.ts). Deliberately leaves
	// native **bold**/*italic* alone — those are real Markdown, not this
	// plugin's own syntax, and read exactly as well without the plugin
	// as with it.
	async runStripFormattingCurrentNote(editor: Editor): Promise<void> {
		const pairs = collectAllDelimiterPairs(this.settings);
		const original = editor.getValue();
		const result = stripDelimitersFromText(original, pairs);
		if (!result.changed) {
			new Notice("Advanced Formatting: nothing to strip in this note.");
			return;
		}
		const cursor = editor.getCursor();
		editor.setValue(result.text);
		// setValue resets the cursor to the top — restoring a best-effort
		// position instead of leaving the user there. Stripping only ever
		// REMOVES characters, never adds any, so clamping the old
		// line/ch against the new (shorter-or-equal) document keeps this
		// in-bounds without needing to track exactly what moved where.
		const line = Math.min(cursor.line, editor.lastLine());
		const ch = Math.min(cursor.ch, editor.getLine(line).length);
		editor.setCursor({ line, ch });
		new Notice("Advanced Formatting: stripped this note's formatting markup.");
	}

	async saveAndApply(): Promise<void> {
		await this.saveData(this.settings);
		this.applyStylesheet();
	}

	applyStylesheet(): void {
		if (this.generatedStyleSheet) this.generatedStyleSheet.replaceSync(buildStylesheet(this.settings));
	}
}

// TypeScript's CommonJS-specific export form — compiles to exactly
// `module.exports = AdvancedFormattingPlugin`, which is what Obsidian's plugin
// loader actually requires. `export default` would instead compile to
// `exports.default = AdvancedFormattingPlugin` under plain tsc/CommonJS (no
// bundler smoothing that over here, since esbuild isn't available), which
// Obsidian cannot instantiate directly — this was caught before ever
// compiling, not discovered by trial and error.
export = AdvancedFormattingPlugin;
