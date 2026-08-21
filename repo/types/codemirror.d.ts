// Hand-written ambient declarations for the small subset of CodeMirror 6
// this plugin uses. Same caveat as types/obsidian.d.ts: no network access
// to fetch the real @codemirror/view / @codemirror/state packages, so
// these are authored from documented CM6 API shapes, not verified against
// the real packages. Obsidian re-exposes these to plugins at runtime via
// `require("@codemirror/view")` / `require("@codemirror/state")`.

declare module "@codemirror/state" {
	export interface Line {
		from: number;
		to: number;
		text: string;
	}

	export interface Text {
		lineAt(pos: number): Line;
		toString(): string;
	}

	export interface SelectionRange {
		from: number;
		to: number;
		empty: boolean;
	}

	export interface EditorSelection {
		ranges: readonly SelectionRange[];
		main: SelectionRange;
	}

	export interface EditorState {
		doc: Text;
		selection: EditorSelection;
		field<T>(field: unknown, required?: boolean): T | undefined;
		sliceDoc(from?: number, to?: number): string;
	}

	export class RangeSetBuilder<T> {
		add(from: number, to: number, value: T): void;
		finish(): unknown;
	}
}

declare module "@codemirror/view" {
	import type { EditorState } from "@codemirror/state";

	export interface VisibleRange {
		from: number;
		to: number;
	}

	export interface EditorView {
		state: EditorState;
		visibleRanges: readonly VisibleRange[];
		plugin<T = any>(plugin: unknown): T | null;
		dispatch(spec: { changes?: { from: number; to: number; insert?: string } }): void;
	}

	export interface ViewUpdate {
		view: EditorView;
		docChanged: boolean;
		viewportChanged: boolean;
		selectionSet: boolean;
	}

	export interface DecorationSpec {
		class?: string;
	}

	// Minimal ambient shape for the subset used by the footnote widgets
	// (numeral badges, the matbaʿa-style separator). Real CM6 WidgetType
	// has more members (updateDOM, estimatedHeight, etc.) — unused ones
	// are omitted rather than guessed at.
	export abstract class WidgetType {
		abstract toDOM(view: EditorView): HTMLElement;
		eq(other: WidgetType): boolean;
		ignoreEvent(event: Event): boolean;
	}

	export class Decoration {
		static mark(spec: DecorationSpec): unknown;
		static replace(spec: { widget?: WidgetType }): unknown;
		static widget(spec: { widget: WidgetType; side?: number; block?: boolean }): unknown;
		static line(spec: { attributes?: { [key: string]: string }; class?: string }): unknown;
		static none: unknown;
	}

	export interface Facet<T> {
		of(value: T): unknown;
	}

	export const EditorView: {
		atomicRanges: Facet<(view: EditorView) => unknown>;
		domEventHandlers(handlers: { [event: string]: (event: any, view: EditorView) => boolean | void }): unknown;
	};

	export interface PluginValue {
		decorations: unknown;
		update?(update: ViewUpdate): void;
	}

	export const ViewPlugin: {
		fromClass<V extends PluginValue>(
			cls: new (view: EditorView) => V,
			spec: { decorations: (value: V) => unknown }
		): unknown;
	};
}
