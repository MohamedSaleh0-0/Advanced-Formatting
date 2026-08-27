import { App, Modal, Setting } from "obsidian";
import { DirectFormatOptions, buildPreviewStyle, defaultDirectFormatOptions } from "./directFormat";
import { openSnippetMenu, renderFontFamilyPicker } from "./uiHelpers";

// Opened by the "Format selection..." command while text is selected.
// Deliberately NOT wired to settings/profiles/saveAndApply directly —
// every field here is local, throwaway modal state (except cssSnippets,
// which is read-only reference data for the popup, not modified here).
// onChange receives the chosen DirectFormatOptions and fires on EVERY
// change to any field EXCEPT Custom CSS — turning that into the actual
// document edit requires the active profile (to find/create the backing
// ephemeral role — see directFormat.ts), which main.ts owns, and main.ts
// applies it live (replacing the previous live result in place) rather
// than waiting for a single "Apply" click, per explicit request: toggling
// a field is enough for the effect to take place immediately, no
// separate confirmation step. Custom CSS is the one exception — it has
// its own "Apply CSS" button instead, since applying raw CSS on every
// keystroke would be disruptive (reformatting the document mid-typo).
//
// onCancel reverts the document to exactly what it was before this modal
// opened (main.ts tracks the original raw text for this) — meaningful
// now that changes apply live rather than only on a final confirm.
//
// If the selection already has direct formatting on it, main.ts passes
// its current properties in as `initialOpts` (via
// resolveFormattingTarget's `existingOpts`) — so re-opening this on
// already-formatted text shows what's actually there (toggles already
// on, color already picked) instead of a blank form, and un-touched
// toggles (e.g. underline, if the user only came here to change color)
// survive into the result rather than silently reverting to off.
export class FormatSelectionModal extends Modal {
	private selectedText: string;
	private onChange: (opts: DirectFormatOptions) => void;
	private onCancel: () => void;
	private opts: DirectFormatOptions;
	private cssSnippets: { name: string; css: string }[];
	private previewEl!: HTMLElement;

	constructor(
		app: App,
		selectedText: string,
		onChange: (opts: DirectFormatOptions) => void,
		onCancel: () => void,
		initialOpts?: DirectFormatOptions,
		cssSnippets?: { name: string; css: string }[]
	) {
		super(app);
		this.selectedText = selectedText;
		this.onChange = onChange;
		this.onCancel = onCancel;
		this.opts = initialOpts ? Object.assign({}, initialOpts) : defaultDirectFormatOptions();
		this.cssSnippets = cssSnippets || [];
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Format selection" });
		contentEl.createEl("p", {
			text: "Changes below apply immediately — no need to press Apply, except for Custom CSS.",
			cls: "af-format-hint",
		});

		if (this.selectedText.includes("\n")) {
			contentEl.createEl("p", {
				text: "Heads up: this selection spans multiple lines/paragraphs. Direct formatting like this only reliably renders within a single paragraph.",
				cls: "af-format-warning",
			});
		}

		new Setting(contentEl).setName("Bold").addToggle((toggle) =>
			toggle.setValue(this.opts.bold).onChange((value) => {
				this.opts.bold = value;
				this.updatePreview();
				this.onChange(this.opts);
			})
		);

		new Setting(contentEl).setName("Italic").addToggle((toggle) =>
			toggle.setValue(this.opts.italic).onChange((value) => {
				this.opts.italic = value;
				this.updatePreview();
				this.onChange(this.opts);
			})
		);

		new Setting(contentEl).setName("Underline").addToggle((toggle) =>
			toggle.setValue(this.opts.underline).onChange((value) => {
				this.opts.underline = value;
				this.updatePreview();
				this.onChange(this.opts);
			})
		);

		const colorSetting = new Setting(contentEl).setName("Text color");
		const colorEnabled = !!this.opts.color;
		colorSetting.addToggle((toggle) =>
			toggle.setValue(colorEnabled).onChange((value) => {
				this.opts.color = value ? this.opts.color || "#B3261E" : "";
				this.updatePreview();
				this.onChange(this.opts);
				this.onOpen();
			})
		);
		if (colorEnabled) {
			colorSetting.addColorPicker((cp) =>
				cp.setValue(this.opts.color).onChange((value) => {
					this.opts.color = value;
					this.updatePreview();
					this.onChange(this.opts);
				})
			);
		}

		const bgSetting = new Setting(contentEl).setName("Background color");
		const bgEnabled = !!this.opts.backgroundColor;
		bgSetting.addToggle((toggle) =>
			toggle.setValue(bgEnabled).onChange((value) => {
				this.opts.backgroundColor = value ? this.opts.backgroundColor || "#FFF7DC" : "";
				this.updatePreview();
				this.onChange(this.opts);
				this.onOpen();
			})
		);
		if (bgEnabled) {
			bgSetting.addColorPicker((cp) =>
				cp.setValue(this.opts.backgroundColor).onChange((value) => {
					this.opts.backgroundColor = value;
					this.updatePreview();
					this.onChange(this.opts);
				})
			);
		}

		renderFontFamilyPicker(contentEl, this.opts.fontFamily, (value) => {
			this.opts.fontFamily = value;
			this.updatePreview();
			this.onChange(this.opts);
		});

		const sizeSetting = new Setting(contentEl).setName("Font size");
		const sizeEnabled = this.opts.sizeEm != null;
		sizeSetting.addToggle((toggle) =>
			toggle.setValue(sizeEnabled).onChange((value) => {
				this.opts.sizeEm = value ? this.opts.sizeEm ?? 1.0 : null;
				this.updatePreview();
				this.onChange(this.opts);
				this.onOpen();
			})
		);
		if (sizeEnabled) {
			sizeSetting.addSlider((slider) =>
				slider
					.setLimits(0.6, 3.0, 0.02)
					.setValue(this.opts.sizeEm as number)
					.setDynamicTooltip()
					.onChange((value) => {
						this.opts.sizeEm = value;
						this.updatePreview();
						this.onChange(this.opts);
					})
			);
		}

		// Custom CSS deliberately does NOT live-apply on every keystroke —
		// reformatting the document mid-typo would be disruptive in a way
		// toggling a checkbox or dragging a slider isn't. "Apply CSS"
		// explicitly triggers the same onChange the other fields use
		// automatically.
		const cssSetting = new Setting(contentEl).setName("Custom CSS").setDesc("Extra declarations spliced into the same rule, e.g. letter-spacing: 0.05em");
		cssSetting.addButton((btn) =>
			btn.setButtonText("Snippets...").onClick((evt) => {
				openSnippetMenu(evt, this.cssSnippets, (css) => {
					this.opts.customCss = this.opts.customCss ? this.opts.customCss + "\n" + css : css;
					this.updatePreview();
					this.onOpen();
				});
			})
		);
		cssSetting.addButton((btn) =>
			btn
				.setButtonText("Apply CSS")
				.setCta()
				.onClick(() => {
					this.updatePreview();
					this.onChange(this.opts);
				})
		);
		new Setting(contentEl).addTextArea((ta) =>
			ta.setValue(this.opts.customCss).onChange((value) => {
				this.opts.customCss = value;
				this.updatePreview();
			})
		);

		contentEl.createEl("div", { text: "Preview:", cls: "af-format-preview-label" });
		this.previewEl = contentEl.createEl("div", { cls: "af-format-preview" });
		this.updatePreview();

		const buttonRow = new Setting(contentEl);
		buttonRow.addButton((btn) =>
			btn.setButtonText("Cancel").onClick(() => {
				this.onCancel();
				this.close();
			})
		);
		buttonRow.addButton((btn) =>
			btn
				.setButtonText("Done")
				.setCta()
				.onClick(() => this.close())
		);
	}

	private updatePreview(): void {
		if (!this.previewEl) return;
		this.previewEl.setAttribute("style", buildPreviewStyle(this.opts));
		this.previewEl.setText(this.selectedText || "Sample text");
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
