export interface DirectFormatOptions {
	bold: boolean;
	italic: boolean;
	underline: boolean;
	color: string;
	backgroundColor: string;
	fontFamily: string;
	sizeEm: number | null;
	customCss: string;
}

export function defaultDirectFormatOptions(): DirectFormatOptions {
	return { bold: false, italic: false, underline: false, color: "", backgroundColor: "", fontFamily: "", sizeEm: null, customCss: "" };
}

export function hasAnyFormatting(opts: DirectFormatOptions): boolean {
	return opts.bold || opts.italic || opts.underline || !!opts.color || !!opts.backgroundColor || !!opts.fontFamily || opts.sizeEm != null || !!opts.customCss.trim();
}

export function buildPreviewStyle(opts: DirectFormatOptions): string {
	const decls: string[] = [];
	if (opts.bold) decls.push("font-weight:700");
	if (opts.italic) decls.push("font-style:italic");
	if (opts.underline) decls.push("text-decoration:underline");
	if (opts.color) decls.push("color:" + opts.color);
	if (opts.backgroundColor) decls.push("background-color:" + opts.backgroundColor);
	if (opts.fontFamily) decls.push("font-family:" + opts.fontFamily);
	if (opts.sizeEm != null) decls.push("font-size:" + opts.sizeEm + "em");
	if (opts.customCss.trim()) decls.push(opts.customCss.trim());
	return decls.join("; ");
}

export function detectBareBoldItalic(lineText: string, fromCh: number, toCh: number): { from: number; to: number; opts: DirectFormatOptions } | null {
	let from = fromCh;
	let to = toCh;
	let italic = false;
	let bold = false;
	if (lineText.slice(from - 2, from) === "**" && lineText.slice(to, to + 2) === "**") {
		bold = true;
		from -= 2;
		to += 2;
	}
	if (lineText[from - 1] === "*" && lineText[to] === "*") {
		italic = true;
		from -= 1;
		to += 1;
	}
	if (!bold && !italic) return null;
	return { from, to, opts: Object.assign(defaultDirectFormatOptions(), { bold, italic }) };
}
