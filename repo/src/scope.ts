import { App, TAbstractFile, TFile } from "obsidian";
import { AdvancedFormattingSettings } from "./types";
import { getActiveProfile } from "./defaults";

export function inFolderList(file: TFile, folders: string[]): boolean {
	const path = file.path;
	return (folders || []).some((f) => {
		const norm = f.replace(/\/+$/, "");
		if (!norm) return false;
		return path === norm || path.startsWith(norm + "/");
	});
}

// Minimal shape this function actually needs from the plugin, rather than
// depending on the full plugin class (keeps this module import-cycle-free).
export interface ScopeCheckable {
	settings: AdvancedFormattingSettings;
}

export function shouldApplyToFile(plugin: ScopeCheckable, file: TFile | TAbstractFile | null, app: App): boolean {
	const scope = getActiveProfile(plugin.settings).scope;
	const mode = scope.mode;

	if (mode === "global") return true;
	if (!file || !(file instanceof TFile)) return false;

	if (mode === "cssclass") {
		const cache = app.metadataCache.getFileCache(file);
		const fm = cache && cache.frontmatter;
		if (!fm) return false;
		let raw = fm.cssclasses || fm.cssclass || [];
		if (!Array.isArray(raw)) raw = [raw];
		return raw.includes(scope.cssclassValue);
	}

	if (mode === "folder-include") return inFolderList(file, scope.folders);
	if (mode === "folder-exclude") return !inFolderList(file, scope.folders);

	if (mode === "smart-arabic-title") {
		return /^[\u0600-\u06FF]/.test((file.basename || "").trim());
	}

	return true;
}
