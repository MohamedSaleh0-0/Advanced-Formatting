import { App, Editor, FuzzySuggestModal } from "obsidian";
import { Role } from "./types";
import { resolveDelims, wrapWithDelims, unwrapDirectFormatting, findEnclosingRoleMatch } from "./delimiters";

// One searchable command ("Wrap selection with role...") that lists every
// role, instead of requiring you to remember or hunt through N separate
// per-role commands in the command palette. Doesn't replace the per-role
// commands — those still exist for hotkey assignment — this is a second,
// lower-friction path to the same action for when you don't have a
// hotkey memorized.
export class RolePickerModal extends FuzzySuggestModal<Role> {
	private roles: Role[];
	private editor: Editor;

	constructor(app: App, roles: Role[], editor: Editor) {
		super(app);
		this.roles = roles;
		this.editor = editor;
		this.setPlaceholder("Wrap selection with role...");
	}

	getItems(): Role[] {
		return this.roles;
	}

	getItemText(role: Role): string {
		const status = role.enabled === false ? " (off)" : "";
		return (role.label || role.id) + status;
	}

	onChooseItem(role: Role): void {
		const delims = resolveDelims(role);
		if (!delims) return;
		const from = this.editor.getCursor("from");
		const to = this.editor.getCursor("to");
		const rawSel = this.editor.getSelection();
		if (!rawSel) return;
		// See findEnclosingRoleMatch in delimiters.ts: the current
		// selection may correctly EXCLUDE a previous formatting's hidden
		// delimiters now (atomic-ranges fix), so replacing only the
		// selection would leave them behind, orphaned. Look for the real
		// boundaries of any existing formatting first.
		if (from.line === to.line) {
			const lineText = this.editor.getLine(from.line);
			const enclosing = findEnclosingRoleMatch(lineText, from.ch, to.ch, this.roles);
			if (enclosing) {
				const span = lineText.slice(enclosing.matchStart, enclosing.matchEnd);
				const clean = unwrapDirectFormatting(span, this.roles);
				this.editor.replaceRange(
					wrapWithDelims(clean, delims.open, delims.close),
					{ line: from.line, ch: enclosing.matchStart },
					{ line: from.line, ch: enclosing.matchEnd }
				);
				return;
			}
		}
		const sel = unwrapDirectFormatting(rawSel, this.roles);
		this.editor.replaceSelection(wrapWithDelims(sel, delims.open, delims.close));
	}
}
