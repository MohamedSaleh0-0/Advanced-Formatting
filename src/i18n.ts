export type UiLanguage = "en" | "ar";

const STRINGS = {
	headingLabel: { en: "Heading {n}", ar: "العنوان {n}" },
	headingSizeLabel: { en: "Size", ar: "الحجم" },
	headingAlignLabel: { en: "Alignment", ar: "المحاذاة" },
	alignAuto: { en: "Auto", ar: "تلقائي" },
	alignRight: { en: "Right", ar: "يمين" },
	alignCenter: { en: "Center", ar: "وسط" },
	alignLeft: { en: "Left", ar: "يسار" },
	textColorLabel: { en: "Text color", ar: "لون النص" },
	fontFamilyDesc: { en: "Choose a bundled, common, or custom font.", ar: "اختر خطًا مرفقًا أو شائعًا أو مخصصًا." },
	boldLabel: { en: "Bold", ar: "غامق" },
	italicLabel: { en: "Italic", ar: "مائل" },
	underlineLabel: { en: "Underline", ar: "تحته خط" },
	customSizeLabel: { en: "Custom size", ar: "حجم مخصص" },
	highlightBgLabel: { en: "Background highlight", ar: "تمييز الخلفية" },
	customCssLabel: { en: "Custom CSS", ar: "CSS مخصص" },
	customCssDesc: { en: "Extra CSS declarations.", ar: "تعريفات CSS إضافية." },
	snippetsBtn: { en: "Snippets...", ar: "مقتطفات..." },
} as const;

export function t(key: keyof typeof STRINGS, lang: UiLanguage | undefined): string {
	return STRINGS[key][lang === "ar" ? "ar" : "en"];
}

export function tn(key: keyof typeof STRINGS, n: number | string, lang: UiLanguage | undefined): string {
	return t(key, lang).replace("{n}", String(n));
}
