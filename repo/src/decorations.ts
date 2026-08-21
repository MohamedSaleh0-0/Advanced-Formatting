import { App } from "obsidian";
import { editorInfoField } from "obsidian";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import type { RangeSetBuilder } from "@codemirror/state";
import { AdvancedFormattingSettings, RoleMatch, Delimiters } from "./types";
import { getActiveProfile } from "./defaults";
import { buildRoleRegexes, buildOrphanedRegexes, findLineMatches } from "./delimiters";
import { detectLineDirection, lineMarkerClusterBounds } from "./direction";
import { detectAlignOverride, detectBoldOverride } from "./headingOverrides";
import { shouldApplyToFile } from "./scope";
import { buildFootnoteNumberMap, findFootnoteDefinitions, findFootnoteReferences, toArabicIndicNumeral } from "./footnotes";

export interface DecoratablePlugin {
	app: App;
	settings: AdvancedFormattingSettings;
	orphanedDelimiterPairs?: Delimiters[];
}

let cmAvailable = true;
let CM_ViewPlugin: any;
let CM_Decoration: any;
let CM_WidgetType: any;
let CM_RangeSetBuilder: any;
let CM_EditorView: any;
try {
	({ ViewPlugin: CM_ViewPlugin, Decoration: CM_Decoration, WidgetType: CM_WidgetType, EditorView: CM_EditorView } = require("@codemirror/view"));
	({ RangeSetBuilder: CM_RangeSetBuilder } = require("@codemirror/state"));
} catch (e) {
	cmAvailable = false;
}

// Widgets are declared lazily, once CM_WidgetType is known to exist —
// extending an unavailable runtime class at module-load time would throw
// even in environments where cmAvailable ends up false (e.g. these tests).
let FootnoteRefWidget: any;
let FootnoteDefMarkerWidget: any;
let FootnoteSeparatorWidget: any;
let DelimiterAliasWidget: any;
if (cmAvailable) {
	FootnoteRefWidget = class extends CM_WidgetType {
		constructor(private numeral: string) {
			super();
		}
		eq(other: any) {
			return other instanceof FootnoteRefWidget && other.numeral === this.numeral;
		}
		toDOM() {
			const sup = document.createElement("sup");
			sup.className = "af-footnote-ref-widget";
			sup.textContent = this.numeral;
			return sup;
		}
		ignoreEvent() {
			return false;
		}
	};

	FootnoteDefMarkerWidget = class extends CM_WidgetType {
		constructor(private numeral: string) {
			super();
		}
		eq(other: any) {
			return other instanceof FootnoteDefMarkerWidget && other.numeral === this.numeral;
		}
		toDOM() {
			const span = document.createElement("span");
			span.className = "af-footnote-def-marker";
			// Trailing NBSP so the definition text doesn't crowd the marker
			// now that the raw "[^label]: " source text is hidden.
			span.textContent = this.numeral + ".\u00A0";
			return span;
		}
		ignoreEvent() {
			return false;
		}
	};

	// Block widget: the matbaʿa-style rule above the first footnote
	// definition. Additive only (Decoration.widget, not .replace) — it
	// doesn't hide anything, just inserts a line above.
	FootnoteSeparatorWidget = class extends CM_WidgetType {
		eq(other: any) {
			return other instanceof FootnoteSeparatorWidget;
		}
		toDOM() {
			const div = document.createElement("div");
			div.className = "af-footnote-separator";
			return div;
		}
		ignoreEvent() {
			return true;
		}
	};

	// Delimiter "alias" display mode — same wikilink-alias UX pattern:
	// shown in place of the real delimiter while the cursor's elsewhere;
	// emitRole swaps this out for the real literal text (a plain mark,
	// not this widget) the moment the cursor enters the span.
	DelimiterAliasWidget = class extends CM_WidgetType {
		constructor(private text: string) {
			super();
		}
		eq(other: any) {
			return other instanceof DelimiterAliasWidget && other.text === this.text;
		}
		toDOM() {
			const span = document.createElement("span");
			span.className = "af-role-alias-widget";
			span.textContent = this.text;
			return span;
		}
		ignoreEvent() {
			return false;
		}
	};
}

export function isCmAvailable(): boolean {
	return cmAvailable;
}

function rangeTouchesSelection(selection: { ranges: readonly { from: number; to: number }[] }, from: number, to: number): boolean {
	for (const range of selection.ranges) {
		if (range.from <= to && range.to >= from) return true;
	}
	return false;
}

function getFileForView(view: EditorView, plugin: DecoratablePlugin) {
	if (editorInfoField) {
		try {
			const info: any = (view.state as any).field(editorInfoField, false);
			if (info && info.file) return info.file;
		} catch (e) {
			/* fall through to the active-file fallback below */
		}
	}
	// Fallback (imperfect with multiple split panes open at once, since it
	// can only know the ACTIVE file, not which file this specific pane
	// shows) — used only if editorInfoField isn't available.
	return plugin.app.workspace.getActiveFile();
}

function isPosVisible(view: EditorView, pos: number): boolean {
	for (const r of view.visibleRanges) {
		if (pos >= r.from && pos <= r.to) return true;
	}
	return false;
}

function buildDecorations(view: EditorView, plugin: DecoratablePlugin): { deco: unknown; atomic: unknown } {
	const builder: RangeSetBuilder<any> = new CM_RangeSetBuilder();

	const file = getFileForView(view, plugin);
	if (!shouldApplyToFile(plugin, file, plugin.app)) {
		const empty = builder.finish();
		return { deco: empty, atomic: empty };
	}

	const roleRegexes = buildRoleRegexes(getActiveProfile(plugin.settings).roles);

	// Every entry carries its finished decoration directly (rather than a
	// role-id/active flag resolved afterward) so footnote widgets can join
	// the same sort-then-add pipeline as role marks — CM6 requires all
	// decorations on one builder added in one sorted, non-overlapping pass.
	//
	// `atomic` marks whether this segment actually HIDES/replaces real
	// document text (a `Decoration.replace`/widget) as opposed to merely
	// styling visible, editable text (a `Decoration.mark`). Only the
	// former should ever be handed to CM6's atomicRanges below — mark
	// decorations cover ordinary editable characters (the role's content,
	// or a SHOWN/active delimiter tag) and must stay normally navigable
	// character-by-character. Feeding mark ranges into atomicRanges too
	// (an earlier version did, via the same combined `decorations` set)
	// is what produced the "many arrow presses to cross one formatted
	// span" bug: the atomic and non-atomic parts of the same span
	// interacted in ways that never let a single clean jump happen.
	type Segment = { from: number; to: number; deco: unknown; atomic: boolean };
	const collected: Segment[] = [];

	// Recursion depth here mirrors the nesting produced by findLineMatches
	// (bounded there, see MAX_NESTING_DEPTH) — walks pre-order: the whole
	// match's tag/content segments first, then each child's segments,
	// which all fall within [contentStart, contentEnd] and therefore sort
	// correctly afterward regardless of insertion order.
	// Delimiter display mode — independent of role.enabled. "auto" is the
	// long-standing default (hide unless the cursor's in the span); the
	// other three are this round's addition. side distinguishes open vs
	// close only for "alias" mode, since each side can have its own
	// alias text.
	function tagDecoration(role: RoleMatch["role"], active: boolean, side: "open" | "close"): { deco: unknown; atomic: boolean } {
		const mode = role.delimiterDisplay || "auto";
		if (mode === "show") {
			// styleDelimiters (only meaningful in "show" mode — the
			// delimiters are already always visible here) adds the SAME
			// "af-role-<id>" class the content span gets, so the tag picks
			// up the role's own color/font/size CSS rule (stylesheet.ts)
			// alongside the generic tag appearance, instead of only ever
			// showing the plain default look.
			const cls = role.styleDelimiters ? "af-role-tag af-role-tag-shown af-role-" + role.id : "af-role-tag af-role-tag-shown";
			return { deco: CM_Decoration.mark({ class: cls }), atomic: false };
		}
		if (mode === "hide") {
			return { deco: CM_Decoration.replace({}), atomic: true };
		}
		if (mode === "alias") {
			if (active) {
				return { deco: CM_Decoration.mark({ class: "af-role-tag af-role-tag-active" }), atomic: false };
			}
			const aliasText = side === "open" ? role.aliasOpen : role.aliasClose;
			if (!aliasText) return { deco: CM_Decoration.replace({}), atomic: true };
			return { deco: CM_Decoration.replace({ widget: new DelimiterAliasWidget(aliasText) }), atomic: true };
		}
		// "auto"
		return active
			? { deco: CM_Decoration.mark({ class: "af-role-tag af-role-tag-active" }), atomic: false }
			: { deco: CM_Decoration.replace({}), atomic: true };
	}

	function emitRole(m: RoleMatch) {
		const active = rangeTouchesSelection(view.state.selection, m.matchStart, m.matchEnd);
		const openTag = tagDecoration(m.role, active, "open");
		collected.push({ from: m.matchStart, to: m.contentStart, deco: openTag.deco, atomic: openTag.atomic });
		collected.push({ from: m.contentStart, to: m.contentEnd, deco: CM_Decoration.mark({ class: "af-role-" + m.role.id }), atomic: false });
		for (const child of m.children) emitRole(child);
		const closeTag = tagDecoration(m.role, active, "close");
		collected.push({ from: m.contentEnd, to: m.matchEnd, deco: closeTag.deco, atomic: closeTag.atomic });
	}

	const orphanRegexes = buildOrphanedRegexes(plugin.orphanedDelimiterPairs || []);

	// Direction markers (direction.ts) are independent of roles/orphans —
	// always walk visible lines to check for one, not just when there's
	// role/orphan matching to do.
	for (const { from, to } of view.visibleRanges) {
		let pos = from;
		while (pos <= to) {
			const line = view.state.doc.lineAt(pos);
			if (roleRegexes.length) {
				const matches = findLineMatches(line.text, line.from, roleRegexes);
				for (const m of matches) emitRole(m);
			}
			// Cross-profile clutter cleanup: these pairs matched the
			// PREVIOUSLY active profile but nothing in the current one
			// (see computeOrphanedDelimiters in main.ts's switchProfile).
			// Hides only the delimiter characters themselves — the
			// content in between stays plain, visible, unstyled text,
			// same as any other role-less text; this is purely about
			// clutter, not about applying anyone's styling to it.
			for (const { delims, regex } of orphanRegexes) {
				regex.lastIndex = 0;
				let om: RegExpExecArray | null;
				while ((om = regex.exec(line.text))) {
					const matchStart = line.from + om.index;
					const matchEnd = matchStart + om[0].length;
					const openEnd = matchStart + delims.open.length;
					const closeStart = matchEnd - delims.close.length;
					if (openEnd > closeStart) continue; // delimiters overlap on a pathologically short match — skip rather than emit a malformed range
					collected.push({ from: matchStart, to: openEnd, deco: CM_Decoration.replace({}), atomic: true });
					collected.push({ from: closeStart, to: matchEnd, deco: CM_Decoration.replace({}), atomic: true });
				}
			}

			// Per-line override markers (direction.ts, headingOverrides.ts):
			// invisible characters placed just after any block-syntax
			// prefix (heading #s, list bullet, blockquote >), never at
			// position 0, so they don't interfere with CommonMark's own
			// block-type parsing for the line. Multiple axes (direction,
			// alignment, bold) can be present on the same line at once, so
			// this collects whichever classes apply and hides the WHOLE
			// marker cluster as one CM6 replace decoration — simpler and
			// more robust than each axis hiding its own single character
			// separately, and correct regardless of how many markers
			// happen to be stacked there.
			const lineClasses: string[] = [];
			const dir = detectLineDirection(line.text);
			if (dir) lineClasses.push(dir === "rtl" ? "af-force-rtl" : "af-force-ltr");
			const align = detectAlignOverride(line.text);
			if (align) lineClasses.push("af-align-" + align);
			const bold = detectBoldOverride(line.text);
			if (bold) lineClasses.push(bold === "on" ? "af-bold-on" : "af-bold-off");

			if (lineClasses.length) {
				collected.push({
					from: line.from,
					to: line.from,
					deco: CM_Decoration.line({ class: lineClasses.join(" ") }),
					atomic: false,
				});
			}
			const cluster = lineMarkerClusterBounds(line.text);
			if (cluster) {
				collected.push({
					from: line.from + cluster.from,
					to: line.from + cluster.to,
					deco: CM_Decoration.replace({}),
					atomic: true,
				});
			}

			pos = line.to + 1;
		}
	}

	// Footnotes: Obsidian's Live Preview doesn't build a footnotes block
	// at all (no separator, no numeral markers), so this constructs one —
	// numbering is computed over the WHOLE document (not just the visible
	// range) so a reference and its definition agree on the same number
	// regardless of scroll position, then only the widgets that actually
	// fall in a visible range get added.
	if (cmAvailable && FootnoteRefWidget) {
		const docText = view.state.doc.toString();
		const defs = findFootnoteDefinitions(docText);
		if (defs.length) {
			const numberMap = buildFootnoteNumberMap(docText);
			const refs = findFootnoteReferences(docText, defs);

			for (const ref of refs) {
				if (!isPosVisible(view, ref.from)) continue;
				const numeral = toArabicIndicNumeral(numberMap.get(ref.label) ?? 0);
				collected.push({ from: ref.from, to: ref.to, deco: CM_Decoration.replace({ widget: new FootnoteRefWidget(numeral) }), atomic: true });
			}

			for (const def of defs) {
				if (!isPosVisible(view, def.markerFrom)) continue;
				const numeral = toArabicIndicNumeral(numberMap.get(def.label) ?? 0);
				collected.push({ from: def.markerFrom, to: def.markerTo, deco: CM_Decoration.replace({ widget: new FootnoteDefMarkerWidget(numeral) }), atomic: true });
			}

			// Separator: once, immediately above the first definition line.
			const first = defs[0];
			if (isPosVisible(view, first.lineFrom)) {
				collected.push({
					from: first.lineFrom,
					to: first.lineFrom,
					deco: CM_Decoration.widget({ widget: new FootnoteSeparatorWidget(), side: -1, block: true }),
					atomic: false,
				});
			}
		}
	}

	if (!collected.length) {
		const empty = builder.finish();
		return { deco: empty, atomic: empty };
	}

	collected.sort((a, b) => a.from - b.from || a.to - b.to);

	// Role decorations and orphaned-delimiter decorations come from two
	// independent matchers over the same text — CM6 requires the whole
	// sequence added to one builder to be strictly non-overlapping, so
	// this is a real safety net, not just defensive style: on adversarial
	// input (e.g. an orphaned pair that's a substring of a live role's
	// delimiters) they could otherwise collide and this whole decoration
	// pass would throw. First-sorted segment wins, same "first match
	// wins" rule findLineMatches already uses for role-vs-role overlaps.
	//
	// The atomic-only builder walks the SAME de-overlapped, sorted
	// sequence but only adds entries flagged atomic (see Segment above) —
	// so atomicRanges below only ever sees genuinely hidden/replaced
	// ranges, never the visible mark decorations for role content or
	// shown/active delimiter tags.
	const atomicBuilder: RangeSetBuilder<any> = new CM_RangeSetBuilder();
	let lastTo = -1;
	for (const r of collected) {
		if (r.from < lastTo) continue;
		builder.add(r.from, r.to, r.deco);
		if (r.atomic && r.to > r.from) atomicBuilder.add(r.from, r.to, CM_Decoration.mark({}));
		lastTo = Math.max(lastTo, r.to);
	}

	return { deco: builder.finish(), atomic: atomicBuilder.finish() };
}

export function createFormattingViewPlugin(plugin: DecoratablePlugin) {
	const viewPlugin = CM_ViewPlugin.fromClass(
		class {
			decorations: unknown;
			atomicDecorations: unknown;
			constructor(view: EditorView) {
				const built = buildDecorations(view, plugin);
				this.decorations = built.deco;
				this.atomicDecorations = built.atomic;
			}
			update(update: ViewUpdate) {
				if (update.docChanged || update.viewportChanged || update.selectionSet) {
					const built = buildDecorations(update.view, plugin);
					this.decorations = built.deco;
					this.atomicDecorations = built.atomic;
				}
			}
		},
		{ decorations: (v: any) => v.decorations }
	);

	if (!cmAvailable) return viewPlugin;

	// Every hidden/replaced range this plugin produces (delimiter tags in
	// "hide"/"auto" mode, footnote ref/def markers, orphaned-delimiter
	// cleanup) needs to be a SINGLE cursor stop, not a run of invisible
	// character positions the caret silently steps through one at a time.
	// Decoration.replace alone only controls what's rendered — CM6 needs
	// EditorView.atomicRanges told about the same ranges separately, or
	// left/right arrow keys keep moving the caret through hidden
	// characters that have nothing visible to show for each step.
	//
	// Feeds atomicDecorations (replace/widget ranges ONLY), not the full
	// decorations set — an earlier version passed the whole mixed set
	// (including mark decorations for visible role content and
	// shown/active tags), which is what caused a formatted span to still
	// need many individual arrow presses to cross even after this fix
	// was first added: mixing atomic and ordinary-editable ranges inside
	// what CM6 treats as one atomic-range provider doesn't cleanly
	// collapse each hidden run into a single jump.
	const atomic = CM_EditorView.atomicRanges.of((view: EditorView) => {
		return view.plugin(viewPlugin)?.atomicDecorations ?? CM_Decoration.none;
	});

	return [viewPlugin, atomic, createClipboardCleanupExtension(plugin)];
}

// Directional isolate control characters `wrapWithDelims` (delimiters.ts)
// adds around every formatted span — invisible in any renderer, but
// literally present in the document text, so a raw copy/cut includes
// them. Stripping is always safe: it never changes visible content, only
// removes invisible formatting-direction characters.
const ISOLATE_CHARS = /[\u2066\u2067\u2069]/g;

// Strips the raw delimiter tokens of every HIDDEN (ephemeral, auto-
// generated by "Format selection") role out of copied/cut text, plus the
// isolate wrapper every role adds. Named/visible roles' own delimiters
// (the human-chosen syntax like «», [?...?], {=...=}) are left alone —
// those are legitimate, intentionally-visible markdown-like syntax the
// user typed, not this plugin's internal bookkeeping.
//
// This is what fixes "copying formatted text outputs gibberish": an
// ephemeral role's delimiters embed a unique id (directFormat.ts) that a
// raw clipboard copy would otherwise include verbatim, since CM6
// decorations only affect rendering — never the underlying document text
// a copy operation actually reads.
function cleanClipboardText(text: string, roles: { hidden?: boolean; open?: string; close?: string }[]): string {
	let out = text.replace(ISOLATE_CHARS, "");
	for (const r of roles) {
		if (!r.hidden || !r.open || !r.close) continue;
		out = out.split(r.open).join("").split(r.close).join("");
	}
	return out;
}

function createClipboardCleanupExtension(plugin: DecoratablePlugin) {
	function handle(event: ClipboardEvent, view: EditorView): void {
		const sel = view.state.selection.main;
		if (sel.empty) return;
		const raw = view.state.sliceDoc(sel.from, sel.to);
		const cleaned = cleanClipboardText(raw, getActiveProfile(plugin.settings).roles);
		if (cleaned === raw) return; // nothing hidden in the selection — let the browser's default handling run
		event.clipboardData?.setData("text/plain", cleaned);
		event.preventDefault();
		if (event.type === "cut") {
			view.dispatch({ changes: { from: sel.from, to: sel.to, insert: "" } });
		}
	}
	return CM_EditorView.domEventHandlers({
		copy: handle,
		cut: handle,
	});
}
