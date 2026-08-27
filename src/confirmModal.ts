import { App, Modal, Setting } from "obsidian";

// Minimal yes/no confirmation dialog. Not used for the per-note strip
// command — that's a normal editor edit, already covered by Ctrl+Z like
// any other command in this plugin. The VAULT-WIDE strip rewrites files
// the user doesn't currently have open, outside that editor's undo
// history, so it gets one explicit confirmation step first instead of
// firing immediately from the command palette.
export class ConfirmModal extends Modal {
	private title: string;
	private message: string;
	private onConfirm: () => void;

	constructor(app: App, title: string, message: string, onConfirm: () => void) {
		super(app);
		this.title = title;
		this.message = message;
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("p", { text: this.message });
		new Setting(contentEl)
			.addButton((btn) => btn.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((btn) =>
				btn
					.setButtonText("Continue")
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}