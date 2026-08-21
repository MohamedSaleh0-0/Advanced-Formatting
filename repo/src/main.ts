import { Editor, EditorPosition, Notice, Plugin, normalizePath } from "obsidian";
import { Delimiters, AdvancedFormattingSettings, Profile, Role, HeadingKey, ListBulletShape } from "./types";
import { DEFAULT_HEADING_STYLES, DEFAULT_SCOPE, DEFAULT_TYPOGRAPHY, DEFAULT_QUICK_COLORS, DEFAULT_CSS_SNIPPETS, defaultRoles, defaultSettings, freshProfile, islamicProfile, getActiveProfile, mergeTypography } from "./defaults";
import { computeOrphanedDelimiters, resolveDelims, buildRoleRegexes, wrapWithDelims, unwrapDirectFormatting, findEnclosingRoleMatch } from "./delimiters";
import { clearFormattingAtRange } from "./clearFormatting";
import { isolate, tn } from "./i18n";
import { validateRoles } from "./validation";
import { shouldApplyToFile } from "./scope";
import { createFormattingViewPlugin, isCmAvailable } from "./decorations";
import { registerReadingModeProcessor } from "./readingMode";
import { buildStylesheet } from "./stylesheet";
import { AdvancedFormattingSettingTab } from "./settingsTab";
import { RolePickerModal } from "./rolePicker";
import { ProfilePickerModal } from "./profilePicker";
import { FormatSelectionModal } from "./formatSelectionModal";
import { CustomColorModal } from "./customColorModal";
import { colorLabel } from "./colorNames";
import { buildBundledFontFaceCss } from "./bundledFonts";
import { buildDirectFormatMarkup, defaultDirectFormatOptions, detectBareBoldItalic, detectExistingFormatAroundRole, DirectFormatOptions, findOrBuildEphemeralRole } from "./directFormat";
import { LineDirection, detectLineDirection, setLineDirection } from "./direction";
import { AlignOverride, BoldOverride, detectAlignOverride, setAlignOverride, detectBoldOverride, setBoldOverride } from "./headingOverrides";
import { detectHeadingKey, detectListDepth } from "./lineContext";

class AdvancedFormattingPlugin extends Plugin {
	settings!: AdvancedFormattingSettings;
	private styleEl!: HTMLStyleElement;
	private fontFaceEl!: HTMLStyleElement;
	// Delimiter pairs the PREVIOUSLY active profile matched but the
	// currently active one doesn't — set on each switchProfile() call,
	// read by decorations.ts to cosmetically hide just those leftover
	// characters (no role styling) so a switch doesn't clutter the
	// editor with now-unrecognized delimiter symbols. Deliberately
	// in-memory only, never saved to disk: resets to empty on reload,
	// and gets REPLACED (not accumulated) on every subsequent switch —
	// only reflects the most recent transition, not the whole session's
	// history of profiles visited. Applies for as long as this session
	// keeps this profile active, to ANY open note using the old
	// delimiters, not just whichever note happened to be open at the
	// moment of the switch.
	orphanedDelimiterPairs: Delimiters[] = [];

	async onload(): Promise<void> {
		await this.loadSettings();
		validateRoles(getActiveProfile(this.settings).roles);

		this.styleEl = document.createElement("style");
		this.styleEl.id = "af-generated-styles";
		document.head.appendChild(this.styleEl);
		this.applyStylesheet();

		// Separate from styleEl above and populated ONCE, not on every
		// saveAndApply() — @font-face declarations for the bundled fonts
		// (bundledFonts.ts) never change at runtime, unlike the
		// per-profile stylesheet. getResourcePath needs the plugin's own
		// vault-relative folder (this.manifest.dir), which is only valid
		// once the plugin has actually loaded.
		this.fontFaceEl = document.createElement("style");
		this.fontFaceEl.id = "af-bundled-fonts";
		document.head.appendChild(this.fontFaceEl);
		if (this.manifest.dir) {
			const dir = this.manifest.dir;
			this.fontFaceEl.textContent = buildBundledFontFaceCss((relativePath) =>
				this.app.vault.adapter.getResourcePath(normalizePath(dir + "/" + relativePath))
			);
		}

		this.updateScopeClass();
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateScopeClass()));
		this.registerEvent(this.app.workspace.on("file-open", () => this.updateScopeClass()));

		if (isCmAvailable()) {
			this.registerEditorExtension(createFormattingViewPlugin(this));
		} else {
			new Notice("Advanced Formatting: live-preview coloring unavailable; Reading view works.");
		}

		registerReadingModeProcessor(this);
		this.addSettingTab(new AdvancedFormattingSettingTab(this.app, this));

		// Only the ACTIVE profile's roles get live commands — switching
		// profiles unregisters the old ones and registers the new ones
		// (see switchProfile below), rather than every profile's roles
		// cluttering the command palette all the time.
		for (const role of getActiveProfile(this.settings).roles) {
			this.registerRoleCommand(role);
		}

		this.addCommand({
			id: "wrap-with-role-search",
			name: "Wrap selection with role... (search)",
			editorCallback: (editor: Editor) => {
				new RolePickerModal(this.app, getActiveProfile(this.settings).roles, editor).open();
			},
		});

		// Direct/instance formatting — deliberately separate from the role
		// commands above rather than folded into the role picker: a role is
		// a saved, reusable, named class; this is one-off MS-Word-style
		// "format just this selection" with no user-visible settings entry
		// created. See directFormat.ts for the full design reasoning,
		// including why this routes through the same role/delimiter engine
		// as named roles (an auto-generated, hidden, one-off Role) instead
		// of raw HTML, and why bold/italic stay native Markdown outside it.
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

		this.addCommand({
			id: "add-islamic-profile",
			name: "Add Islamic/Arabic profile",
			callback: async () => {
				const p = this.addIslamicProfile();
				await this.saveAndApply();
				new Notice(tn("noticeAddedProfile", isolate(p.name), this.settings.uiLanguage));
			},
		});

		// Right-click access to both, not just command palette/hotkey —
		// requested explicitly. Format selection only makes sense with an
		// active selection; Clear formatting is offered whenever the
		// cursor's on a line at all (it Notices if nothing formatted is
		// actually there, same as invoking it via hotkey with nothing to
		// clear).
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				if (editor.getSelection()) {
					menu.addItem((item) =>
						item
							.setTitle("Format selection...")
							.setIcon("paintbrush")
							.onClick(() => this.openFormatSelectionModal(editor))
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
				const colorizeRange = editor.getSelection() ? null : this.getWordRangeAtCursor(editor);
				if (editor.getSelection() || colorizeRange) {
					const profile = getActiveProfile(this.settings);
					for (const color of profile.quickColors) {
						menu.addItem((item) =>
							item
								.setTitle(this.colorMenuTitle(color))
								.onClick(async () => {
									if (colorizeRange) editor.setSelection(colorizeRange.from, colorizeRange.to);
									await this.runColorize(editor, color);
								})
						);
					}
					menu.addItem((item) =>
						item
							.setTitle("Colorize: Custom...")
							.setIcon("palette")
							.onClick(() => {
								if (colorizeRange) editor.setSelection(colorizeRange.from, colorizeRange.to);
								new CustomColorModal(this.app, async (color) => {
									await this.runColorize(editor, color);
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
					const profile = getActiveProfile(this.settings);
					const shapes: ListBulletShape[] = ["circle", "square", "diamond"];
					const idx = listDepth - 1;
					for (const shape of shapes) {
						menu.addItem((item) =>
							item
								.setTitle("Bullet (level " + listDepth + "): " + shape)
								.setIcon("list")
								.setChecked(profile.typography.listBulletShapes[idx] === shape)
								.onClick(async () => {
									while (profile.typography.listBulletShapes.length <= idx) {
										profile.typography.listBulletShapes.push("circle");
									}
									profile.typography.listBulletShapes[idx] = shape;
									await this.saveAndApply();
								})
						);
					}
				}
			})
		);

		this.addCommand({
			id: "switch-profile",
			name: "Switch profile...",
			callback: () => {
				new ProfilePickerModal(this.app, this.settings.profiles, (profile) => this.switchProfile(profile.id)).open();
			},
		});

		this.addCommand({
			id: "insert-footnote",
			name: "Insert footnote",
			editorCallback: (editor: Editor) => {
				const text = editor.getValue();
				const nums: number[] = [];
				const refRegex = /\[\^(\d+)\]/g;
				let rm: RegExpExecArray | null;
				while ((rm = refRegex.exec(text))) nums.push(parseInt(rm[1], 10));
				const next = nums.length ? Math.max.apply(null, nums) + 1 : 1;

				const cursor = editor.getCursor();
				editor.replaceRange("[^" + next + "]", cursor);

				const lastLine = editor.lastLine();
				const lastLineLen = editor.getLine(lastLine).length;
				const insertPos = { line: lastLine, ch: lastLineLen };
				const prefix = lastLineLen === 0 ? "" : "\n";
				editor.replaceRange(prefix + "[^" + next + "]: ", insertPos);

				const newLastLine = editor.lastLine();
				editor.setCursor({ line: newLastLine, ch: editor.getLine(newLastLine).length });
				editor.focus();
			},
		});
	}

	onunload(): void {
		if (this.styleEl) this.styleEl.remove();
		if (this.fontFaceEl) this.fontFaceEl.remove();
		document.body.classList.remove("af-scope-active");
	}

	updateScopeClass(): void {
		const file = this.app.workspace.getActiveFile();
		const apply = shouldApplyToFile(this, file, this.app);
		document.body.classList.toggle("af-scope-active", apply);
	}

	// Every role in the ACTIVE profile is also a command, assignable to a
	// hotkey via Obsidian's own Settings -> Hotkeys. Split out from onload
	// so a role added/removed/switched-in at runtime gets/loses its
	// command immediately.
	//
	// Inserts regardless of role.enabled: a disabled role is "defined but
	// inert" (see types.ts) — no matching, no decoration, no CSS — not
	// "refuses to be used." Blocking the wrap here with a notice
	// contradicted that everywhere else in the codebase; the delimiters
	// just sit there with no visible effect until the role's turned back
	// on, exactly like they would if you typed them by hand.
	// Right-clicking a plain word with nothing selected is the common case
	// "Colorize" was asked for — Obsidian's editor-menu doesn't auto-
	// select the word under a right-click the way some editors do, so
	// this expands outward from the cursor position over Unicode
	// letters/digits/underscore (covers Arabic script too, not just
	// ASCII word characters) to find the word's real boundaries. Returns
	// null if the cursor isn't actually touching a word (e.g. it's on
	// whitespace or punctuation).
	// A plain "Colorize: #E03131" menu item asks the user to recognize a
	// hex code by eye, which is exactly what was reported as unusable —
	// nobody memorizes hex values. MenuItem.setIcon can't be tinted
	// per-item (Obsidian's icons are monochrome Lucide icons, no color
	// parameter), but setTitle DOES accept a DocumentFragment, not just a
	// string — so this builds a real colored circle (inline
	// background-color, unlike the icon slot) next to a human-readable
	// name from colorNames.ts, falling back to the hex only when no
	// common color name is a close enough match.
	colorMenuTitle(hex: string): DocumentFragment {
		const frag = document.createDocumentFragment();
		const swatch = document.createElement("span");
		swatch.style.cssText =
			"display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;vertical-align:middle;background-color:" +
			hex +
			";border:1px solid var(--background-modifier-border);";
		frag.appendChild(swatch);
		frag.appendChild(document.createTextNode("Colorize: " + colorLabel(hex)));
		return frag;
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
		const roles = getActiveProfile(this.settings).roles;
		if (from.line === to.line) {
			const lineText = editor.getLine(from.line);
			const enclosing = findEnclosingRoleMatch(lineText, from.ch, to.ch, roles);
			if (enclosing) {
				const detected = detectExistingFormatAroundRole(lineText, enclosing.matchStart, enclosing.matchEnd, enclosing.role);
				const span = lineText.slice(detected.from, detected.to);
				return {
					from: { line: from.line, ch: detected.from },
					to: { line: from.line, ch: detected.to },
					clean: unwrapDirectFormatting(span, roles),
					raw: span,
					existingOpts: detected.opts,
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
		return { from, to, clean: unwrapDirectFormatting(rawSel, roles), raw: rawSel, existingOpts: null };
	}

	registerRoleCommand(role: Role): void {
		this.addCommand({
			id: "wrap-as-" + role.id,
			name: "Wrap selection as " + (role.label || role.id),
			editorCallback: (editor: Editor) => {
				const delims = resolveDelims(role);
				if (!delims) return;
				const target = this.resolveFormattingTarget(editor);
				if (!target) return;
				editor.replaceRange(wrapWithDelims(target.clean, delims.open, delims.close), target.from, target.to);
			},
		});
	}

	unregisterRoleCommand(role: Role): void {
		try {
			this.app.commands.removeCommand(this.manifest.id + ":wrap-as-" + role.id);
		} catch (e) {
			/* best-effort — an orphaned command entry is harmless if this fails */
		}
	}

	// Manual, global switch — per your explicit choice: one active profile
	// at a time, switched by you (command or settings dropdown), not
	// auto-selected per note by scope. Re-registers role commands so the
	// command palette / hotkeys reflect the newly active profile's roles,
	// not the old one's.
	async switchProfile(id: string): Promise<void> {
		if (id === this.settings.activeProfileId) return;
		const oldProfile = getActiveProfile(this.settings);
		for (const role of oldProfile.roles) this.unregisterRoleCommand(role);

		this.settings.activeProfileId = id;

		const newProfile = getActiveProfile(this.settings);
		for (const role of newProfile.roles) this.registerRoleCommand(role);
		this.orphanedDelimiterPairs = computeOrphanedDelimiters(oldProfile, newProfile);

		await this.saveAndApply();
		new Notice(tn("noticeSwitchedTo", isolate(newProfile.name), this.settings.uiLanguage));
	}

	createProfile(name: string): Profile {
		const p = freshProfile("profile" + Date.now(), name);
		this.settings.profiles.push(p);
		return p;
	}

	// Appends the ready-made Islamic/Arabic profile (defaults.ts) — same
	// "just another profile, deletable through the normal profile-delete
	// UI, never the shipped default" reasoning as any imported profile.
	addIslamicProfile(): Profile {
		const p = islamicProfile();
		this.settings.profiles.push(p);
		return p;
	}

	duplicateProfile(id: string): Profile | null {
		const src = this.settings.profiles.find((p) => p.id === id);
		if (!src) return null;
		const copy: Profile = JSON.parse(JSON.stringify(src));
		copy.id = "profile" + Date.now();
		copy.name = src.name + " (copy)";
		this.settings.profiles.push(copy);
		return copy;
	}

	deleteProfile(id: string): void {
		if (this.settings.profiles.length <= 1) {
			new Notice(tn("noticeCantDeleteLast", "", this.settings.uiLanguage));
			return;
		}
		const wasActive = this.settings.activeProfileId === id;
		const deletedRoles = wasActive ? getActiveProfile(this.settings).roles : [];
		this.settings.profiles = this.settings.profiles.filter((p) => p.id !== id);
		if (wasActive) {
			this.settings.activeProfileId = this.settings.profiles[0].id;
			// Same command-registry swap switchProfile does — deleting the
			// active profile is itself an implicit switch to the fallback.
			for (const role of deletedRoles) this.unregisterRoleCommand(role);
			const fallback = getActiveProfile(this.settings);
			for (const role of fallback.roles) this.registerRoleCommand(role);
			this.orphanedDelimiterPairs = computeOrphanedDelimiters({ ...fallback, roles: deletedRoles }, fallback);
		}
	}

	// Fills in defaults for any field a profile is missing — used both for
	// profiles already in the new shape (in case a field was added to the
	// schema since they were saved) and for the migration path below.
	private hydrateProfile(p: any): Profile {
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
		const scope = Object.assign({}, DEFAULT_SCOPE, p.scope || {});
		if (!Array.isArray(scope.folders)) scope.folders = [];

		const quickColors = Array.isArray(p.quickColors) ? p.quickColors : DEFAULT_QUICK_COLORS.slice();
		const cssSnippets = Array.isArray(p.cssSnippets) ? p.cssSnippets : DEFAULT_CSS_SNIPPETS.map((s) => Object.assign({}, s));

		return {
			id: p.id || "profile" + Date.now(),
			name: p.name || "Profile",
			description: typeof p.description === "string" ? p.description : "",
			roles: p.roles && p.roles.length ? p.roles : defaultRoles(),
			typography,
			scope,
			quickColors,
			cssSnippets,
		};
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) || {};
		const uiLanguage: "en" | "ar" = data.uiLanguage === "ar" ? "ar" : "en";

		if (data.profiles && Array.isArray(data.profiles) && data.profiles.length) {
			// Already the new (profiles) shape.
			const profiles = data.profiles.map((p: any) => this.hydrateProfile(p));
			const activeProfileId =
				data.activeProfileId && profiles.some((p: Profile) => p.id === data.activeProfileId)
					? data.activeProfileId
					: profiles[0].id;
			this.settings = { profiles, activeProfileId, uiLanguage };
		} else if (data.roles || data.typography || data.scope) {
			// Pre-profiles saved data (single roles/typography/scope at the
			// top level) — migrate into one "Default" profile so nothing
			// already configured is lost.
			const migrated = this.hydrateProfile({
				id: "default",
				name: "Default",
				roles: data.roles,
				typography: data.typography,
				scope: data.scope,
			});
			this.settings = { profiles: [migrated], activeProfileId: migrated.id, uiLanguage };
		} else {
			// Fresh install.
			this.settings = defaultSettings();
		}
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
		const profile = getActiveProfile(this.settings);
		// Start from whatever's already there (bold/underline/font/etc.)
		// and only override color — NOT a blank slate. Colorize is meant
		// to be a fast "just change the color" action, not "replace all
		// formatting with color only."
		const opts = Object.assign({}, target.existingOpts || defaultDirectFormatOptions(), { color });
		const role = findOrBuildEphemeralRole(profile, opts);
		if (role && !profile.roles.includes(role)) {
			profile.roles.push(role);
		}
		await this.saveAndApply();
		editor.replaceRange(buildDirectFormatMarkup(target.clean, opts, role), target.from, target.to);
	}

	openFormatSelectionModal(editor: Editor): void {
		const target = this.resolveFormattingTarget(editor);
		if (!target) {
			new Notice("Advanced Formatting: select some text first.");
			return;
		}
		const profile = getActiveProfile(this.settings);
		const sel = target.clean;
		let currentFrom = target.from;
		let currentTo = target.to;
		// A role WE created this session that isn't (yet, or ever) reused
		// by anything else — cleaned up/replaced on every subsequent
		// change rather than left behind, so toggling through several
		// combinations in one live-editing session leaves at most ONE
		// extra role in Settings when the modal closes (the final one
		// actually used), not one per toggle along the way.
		let pendingNewRole: Role | null = null;

		const applyLive = async (opts: DirectFormatOptions) => {
			const role = findOrBuildEphemeralRole(profile, opts);
			if (pendingNewRole && pendingNewRole !== role) {
				const idx = profile.roles.indexOf(pendingNewRole);
				if (idx !== -1) profile.roles.splice(idx, 1);
				pendingNewRole = null;
			}
			if (role && !profile.roles.includes(role)) {
				profile.roles.push(role);
				pendingNewRole = role;
			}
			// Must land in settings + the regenerated stylesheet BEFORE
			// replaceRange fires the docChanged transaction that makes
			// decorations.ts re-read them — otherwise the very first
			// render of the new role's text has no matching CSS/regex yet.
			await this.saveAndApply();
			const markup = buildDirectFormatMarkup(sel, opts, role);
			editor.replaceRange(markup, currentFrom, currentTo);
			currentTo = { line: currentFrom.line, ch: currentFrom.ch + markup.length };
		};

		const cancel = async () => {
			if (pendingNewRole) {
				const idx = profile.roles.indexOf(pendingNewRole);
				if (idx !== -1) profile.roles.splice(idx, 1);
				pendingNewRole = null;
				await this.saveAndApply();
			}
			editor.replaceRange(target.raw, currentFrom, currentTo);
		};

		new FormatSelectionModal(this.app, sel, applyLive, cancel, target.existingOpts || undefined, profile.cssSnippets).open();
	}

	runClearFormatting(editor: Editor): void {
		const from = editor.getCursor("from");
		const to = editor.getCursor("to");
		if (from.line !== to.line) {
			new Notice("Advanced Formatting: clearing formatting across multiple lines isn't supported — select within one line.");
			return;
		}
		const line = editor.getLine(from.line);
		const roleRegexes = buildRoleRegexes(getActiveProfile(this.settings).roles);
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

	async saveAndApply(): Promise<void> {
		await this.saveData(this.settings);
		this.applyStylesheet();
		this.updateScopeClass();
	}

	applyStylesheet(): void {
		if (this.styleEl) this.styleEl.textContent = buildStylesheet(getActiveProfile(this.settings));
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
