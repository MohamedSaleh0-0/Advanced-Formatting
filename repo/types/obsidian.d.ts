// Hand-written ambient declarations for the Obsidian API surface this
// plugin actually calls. NOT the official `obsidian` type package — there
// is no network access in the build environment this was authored in to
// fetch it. Written to match documented/well-known Obsidian plugin API
// shapes as closely as possible. Treat "compiles against this" as
// "internally consistent with the author's understanding of the API",
// not "verified against Obsidian's real types". If the real `obsidian`
// package is available when building this for real, delete this file and
// `npm install obsidian` instead — everything here is a subset of it.

declare module "obsidian" {
	export function normalizePath(path: string): string;

	export class TAbstractFile {
		path: string;
		name: string;
		parent: TFolder | null;
	}

	export class TFile extends TAbstractFile {
		basename: string;
		extension: string;
	}

	export class TFolder extends TAbstractFile {
		path: string;
	}

	export interface FrontMatterCache {
		cssclasses?: string | string[];
		cssclass?: string | string[];
		[key: string]: unknown;
	}

	export interface CachedMetadata {
		frontmatter?: FrontMatterCache;
	}

	export class MetadataCache {
		getFileCache(file: TFile): CachedMetadata | null;
	}

	export interface DataAdapter {
		getResourcePath(normalizedPath: string): string;
	}

	export class Vault {
		adapter: DataAdapter;
		getAbstractFileByPath(path: string): TAbstractFile | null;
	}

	export class Workspace {
		getActiveFile(): TFile | null;
		on(name: "active-leaf-change" | "file-open", callback: () => any): EventRef;
		on(name: "editor-menu", callback: (menu: Menu, editor: Editor, info: unknown) => any): EventRef;
	}

	export interface EventRef {}

	export class MenuItem {
		setTitle(title: string | DocumentFragment): this;
		setIcon(icon: string | null): this;
		setChecked(checked: boolean | null): this;
		setDisabled(disabled: boolean): this;
		onClick(callback: (evt: MouseEvent | KeyboardEvent) => any): this;
	}

	export class Menu {
		constructor();
		addItem(cb: (item: MenuItem) => any): this;
		addSeparator(): this;
		showAtMouseEvent(evt: MouseEvent): this;
	}

	export interface CommandRegistry {
		removeCommand(id: string): void;
	}

	export class App {
		workspace: Workspace;
		vault: Vault;
		metadataCache: MetadataCache;
		commands: CommandRegistry;
	}

	export interface EditorPosition {
		line: number;
		ch: number;
	}

	export class Editor {
		getSelection(): string;
		replaceSelection(replacement: string): void;
		getCursor(side?: "from" | "to" | "head" | "anchor"): EditorPosition;
		replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition): void;
		lastLine(): number;
		getLine(line: number): string;
		setLine(line: number, text: string): void;
		setCursor(pos: EditorPosition): void;
		setSelection(anchor: EditorPosition, head?: EditorPosition): void;
		somethingSelected(): boolean;
		getValue(): string;
		focus(): void;
	}

	export interface Command {
		id: string;
		name: string;
		editorCallback?: (editor: Editor) => any;
		callback?: () => any;
	}

	export interface MarkdownPostProcessorContext {
		sourcePath: string;
	}

	export type MarkdownPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => void;

	export interface PluginManifest {
		id: string;
		name: string;
		version: string;
		dir?: string;
	}

	export class Component {
		registerEvent(eventRef: EventRef): void;
	}

	export class Plugin extends Component {
		app: App;
		manifest: PluginManifest;
		constructor(app: App, manifest: PluginManifest);
		addCommand(command: Command): Command;
		addSettingTab(tab: PluginSettingTab): void;
		registerEditorExtension(extension: unknown): void;
		registerMarkdownPostProcessor(processor: MarkdownPostProcessor): void;
		loadData(): Promise<any>;
		saveData(data: any): Promise<void>;
		onload(): Promise<void> | void;
		onunload(): void;
	}

	export class PluginSettingTab {
		app: App;
		plugin: Plugin;
		containerEl: HTMLElement;
		constructor(app: App, plugin: Plugin);
		display(): void;
		hide(): void;
	}

	export class Modal {
		app: App;
		contentEl: HTMLElement;
		constructor(app: App);
		open(): void;
		close(): void;
		onOpen(): void;
		onClose(): void;
	}

	export interface FuzzyMatch<T> {
		item: T;
		match: unknown;
	}

	export abstract class FuzzySuggestModal<T> extends Modal {
		constructor(app: App);
		setPlaceholder(text: string): void;
		abstract getItems(): T[];
		abstract getItemText(item: T): string;
		abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;
		renderSuggestion?(item: FuzzyMatch<T>, el: HTMLElement): void;
	}

	export class Notice {
		noticeEl: HTMLElement;
		constructor(message: string, timeout?: number);
		hide(): void;
	}

	export class ValueComponent<T> {
		setValue(value: T): this;
		onChange(callback: (value: T) => any): this;
	}

	export class ToggleComponent extends ValueComponent<boolean> {
		constructor(containerEl: HTMLElement);
		setTooltip(tooltip: string): this;
	}

	export class TextComponent extends ValueComponent<string> {
		constructor(containerEl: HTMLElement);
		setPlaceholder(placeholder: string): this;
		inputEl: HTMLInputElement;
	}

	export class TextAreaComponent extends ValueComponent<string> {
		constructor(containerEl: HTMLElement);
		setPlaceholder(placeholder: string): this;
		inputEl: HTMLTextAreaElement;
	}

	export class SliderComponent extends ValueComponent<number> {
		constructor(containerEl: HTMLElement);
		setLimits(min: number, max: number, step: number): this;
		setDynamicTooltip(): this;
	}

	export class DropdownComponent extends ValueComponent<string> {
		constructor(containerEl: HTMLElement);
		selectEl: HTMLSelectElement;
		addOption(value: string, display: string): this;
		addOptions(options: Record<string, string>): this;
		setValue(value: string): this;
		onChange(callback: (value: string) => any): this;
	}

	export class ColorComponent extends ValueComponent<string> {
		constructor(containerEl: HTMLElement);
	}

	export class ButtonComponent {
		constructor(containerEl: HTMLElement);
		setButtonText(text: string): this;
		setCta(): this;
		onClick(callback: (evt: MouseEvent) => any): this;
	}

	export class ExtraButtonComponent {
		constructor(containerEl: HTMLElement);
		setIcon(icon: string): this;
		setTooltip(tooltip: string): this;
		onClick(callback: () => any): this;
	}

	export class Setting {
		settingEl: HTMLElement;
		controlEl: HTMLElement;
		constructor(containerEl: HTMLElement);
		setName(name: string): this;
		setDesc(desc: string): this;
		addText(cb: (component: TextComponent) => any): this;
		addTextArea(cb: (component: TextAreaComponent) => any): this;
		addToggle(cb: (component: ToggleComponent) => any): this;
		addSlider(cb: (component: SliderComponent) => any): this;
		addDropdown(cb: (component: DropdownComponent) => any): this;
		addColorPicker(cb: (component: ColorComponent) => any): this;
		addButton(cb: (component: ButtonComponent) => any): this;
		addExtraButton(cb: (component: ExtraButtonComponent) => any): this;
	}

	// Undocumented-but-commonly-used facet that exposes the MarkdownView
	// (and therefore the TFile) a CodeMirror 6 EditorView belongs to.
	// Typed loosely on purpose — see the note at the top of this file.
	export const editorInfoField: unknown;
}

// Obsidian augments HTMLElement.prototype with these helpers app-wide.
interface HTMLElement {
	empty(): void;
	createEl<K extends keyof HTMLElementTagNameMap>(
		tag: K,
		attrs?: { text?: string; cls?: string; type?: string; value?: string }
	): HTMLElementTagNameMap[K];
	createDiv(attrs?: { text?: string; cls?: string }): HTMLDivElement;
	createSpan(attrs?: { text?: string; cls?: string }): HTMLSpanElement;
	setText(text: string): void;
	addClass(cls: string): void;
}
