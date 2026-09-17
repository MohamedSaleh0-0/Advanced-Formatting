import { App } from "obsidian";
import { DirectFormatOptions, buildPreviewStyle, defaultDirectFormatOptions } from "./directFormat";
import { renderFontFamilyPicker } from "./uiHelpers";

// A small editor-anchored popover. It intentionally is not an Obsidian
// Modal: opening it from the editor context menu must not leave a second,
// large window floating over the note.
export class FormatSelectionModal {
	private opts: DirectFormatOptions;
	private root: HTMLElement | null = null;
	private outsideHandler?: (event: MouseEvent) => void;
	private keyHandler?: (event: KeyboardEvent) => void;

	constructor(
		private _app: App,
		private selectedText: string,
		private onApply: (opts: DirectFormatOptions) => void,
		private onCancel: () => void,
		initialOpts?: DirectFormatOptions
	) {
		this.opts = Object.assign(defaultDirectFormatOptions(), initialOpts || {});
	}

	open(): void {
		this.close(false);
		const root = document.body.createDiv({ cls: "af-format-popover" });
		this.root = root;
		const header = root.createDiv({ cls: "af-format-popover-header" });
		header.createEl("strong", { text: "Format selection" });
		const close = header.createEl("button", { text: "×", cls: "af-format-popover-close" });
		close.addEventListener("click", () => { this.onCancel(); this.close(false); });

		const controls = root.createDiv({ cls: "af-format-popover-controls" });
		this.toggle(controls, "Bold", "bold");
		this.toggle(controls, "Italic", "italic");
		this.toggle(controls, "Underline", "underline");
		this.color(controls, "Text color", "color");
		this.color(controls, "Background", "backgroundColor");
		renderFontFamilyPicker(controls, this.opts.fontFamily, (value) => { this.opts.fontFamily = value; this.preview(); this.notifyChange(); });
		this.size(controls);

		const preview = root.createDiv({ cls: "af-format-popover-preview" });
		preview.createEl("span", { text: "Preview" });
		const sample = preview.createSpan({ cls: "af-format-preview" });
		(sample as HTMLElement).dataset.preview = "true";
		this.previewEl = sample;
		this.preview();

		const actions = root.createDiv({ cls: "af-format-popover-actions" });
		const cancel = actions.createEl("button", { text: "Cancel" });
		cancel.addEventListener("click", () => { this.onCancel(); this.close(false); });

		this.position(root);
		this.outsideHandler = (event) => { if (!root.contains(event.target as Node)) { this.onCancel(); this.close(false); } };
		this.keyHandler = (event) => { if (event.key === "Escape") { this.onCancel(); this.close(false); } };
		window.addEventListener("mousedown", this.outsideHandler, true);
		window.addEventListener("keydown", this.keyHandler, true);
	}

	private previewEl!: HTMLElement;

	private toggle(parent: HTMLElement, label: string, key: "bold" | "italic" | "underline"): void {
		const row = parent.createDiv({ cls: "af-format-popover-row" });
		const input = row.createEl("input", { type: "checkbox" });
		input.checked = this.opts[key];
		row.createEl("label", { text: label });
		input.addEventListener("change", () => { this.opts[key] = input.checked; this.preview(); this.notifyChange(); });
	}

	private color(parent: HTMLElement, label: string, key: "color" | "backgroundColor"): void {
		const row = parent.createDiv({ cls: "af-format-popover-row" });
		const input = row.createEl("input", { type: "color" });
		const enabled = !!this.opts[key];
		input.value = enabled ? this.opts[key] : (key === "color" ? "#B3261E" : "#FFF3CD");
		const checkbox = row.createEl("input", { type: "checkbox" });
		checkbox.checked = enabled;
		row.createEl("label", { text: label });
		checkbox.addEventListener("change", () => { this.opts[key] = checkbox.checked ? input.value : ""; this.preview(); this.notifyChange(); });
		input.addEventListener("input", () => { this.opts[key] = input.value; checkbox.checked = true; this.preview(); this.notifyChange(); });
	}

	private size(parent: HTMLElement): void {
		const row = parent.createDiv({ cls: "af-format-popover-row" });
		const input = row.createEl("input", { type: "number" });
		input.setAttribute("min", "0.6");
		input.setAttribute("max", "3");
		input.setAttribute("step", "0.05");
		input.value = String(this.opts.sizeEm ?? 1);
		row.createEl("label", { text: "Font size" });
		input.addEventListener("input", () => { this.opts.sizeEm = Number(input.value) || 1; this.preview(); this.notifyChange(); });
	}

	private notifyChange(): void {
		this.onApply(this.opts);
	}

	private preview(): void {
		if (!this.previewEl) return;
		this.previewEl.setAttribute("style", buildPreviewStyle(this.opts));
		this.previewEl.setText(this.selectedText || "Sample text");
	}

	private position(root: HTMLElement): void {
		const selection = document.querySelector<HTMLElement>(".cm-selectionBackground");
		const rect = selection?.getBoundingClientRect();
		const width = 340;
		let left = rect ? rect.left : (window.innerWidth - width) / 2;
		let top = rect ? rect.bottom + 8 : 120;
		left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
		if (top + 420 > window.innerHeight) top = Math.max(12, (rect?.top || 120) - 430);
		root.style.left = left + "px";
		root.style.top = top + "px";
	}

	close(_notify = true): void {
		if (this.outsideHandler) window.removeEventListener("mousedown", this.outsideHandler, true);
		if (this.keyHandler) window.removeEventListener("keydown", this.keyHandler, true);
		this.outsideHandler = undefined;
		this.keyHandler = undefined;
		this.root?.remove();
		this.root = null;
	}
}
