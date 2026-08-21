import { App, Modal, Setting } from "obsidian";

// Opened by the right-click "Colorize -> Custom..." menu item — the
// declared quick-color swatches (profile.quickColors, edited in
// Settings) are one-click, but a one-off color that isn't worth adding
// to that permanent list still needs somewhere to come from.
export class CustomColorModal extends Modal {
	private onPick: (color: string) => void;
	private color = "#888888";

	constructor(app: App, onPick: (color: string) => void) {
		super(app);
		this.onPick = onPick;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Custom color" });

		new Setting(contentEl).setName("Color").addColorPicker((picker) =>
			picker.setValue(this.color).onChange((value) => {
				this.color = value;
			})
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Apply")
				.setCta()
				.onClick(() => {
					this.onPick(this.color);
					this.close();
				})
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
