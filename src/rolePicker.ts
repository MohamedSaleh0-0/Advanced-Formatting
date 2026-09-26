import { App, Editor, FuzzySuggestModal } from "obsidian";
import { Role } from "./types";
import { unwrapDirectFormatting } from "./delimiters";
import { buildRoleSyntaxMarkup, detectTextDirection, findDirectMatches, findRoleSyntaxMatches, unwrapReadableSyntax } from "./directSyntax";

// One searchable command ("Apply inline role...") that lists every
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
		this.setPlaceholder("Apply inline role...");
	}

	// Excludes hidden/ephemeral roles (see Role.hidden in types.ts) — the
	// ones auto-generated one-per-distinct-style by Colorize/Format
	// selection. They have no meaningful "label" a user would recognize
	// (just a raw generated id), and were never meant to be picked from
	// a list the way a real, user-named role is; the Settings pane's
	// role list already excludes them for the same reason (see types.ts
	// comment on Role.hidden) — this just closes the same gap here.
	// Deliberately filters `this.roles` only for DISPLAY: onChooseItem
	// below still needs the full, unfiltered list (including hidden
	// roles) for findEnclosingRoleMatch/unwrapDirectFormatting, since a
	// selection being re-wrapped might already sit inside one of those.
	getItems(): Role[] {
		return this.roles.filter((r) => !r.hidden && r.enabled !== false);
	}

	getItemText(role: Role): string {
		const status = role.enabled === false ? " (off)" : "";
		return (role.label || role.id) + status;
	}

	onChooseItem(role: Role): void {
		const from = this.editor.getCursor("from");
		const to = this.editor.getCursor("to");
		const rawSel = this.editor.getSelection();
		if (!rawSel) return;
		if (from.line === to.line) {
			const line = this.editor.getLine(from.line);
			const direction = detectTextDirection(unwrapReadableSyntax(line, this.roles));
			const existing = [...findDirectMatches(line), ...findRoleSyntaxMatches(line, this.roles)].find((match) => match.matchStart <= from.ch && match.matchEnd >= to.ch);
			if (existing) {
				this.editor.replaceRange(buildRoleSyntaxMarkup(line.slice(existing.contentStart, existing.contentEnd), role, direction), { line: from.line, ch: existing.matchStart }, { line: from.line, ch: existing.matchEnd });
				return;
			}
		}
		const sel = unwrapReadableSyntax(unwrapDirectFormatting(rawSel, this.roles), this.roles);
		const line = unwrapReadableSyntax(this.editor.getLine(from.line), this.roles);
		this.editor.replaceSelection(buildRoleSyntaxMarkup(sel, role, detectTextDirection(line)));
	}
}
