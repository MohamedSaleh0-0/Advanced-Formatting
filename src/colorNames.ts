// A small, deliberately short list of common, visually-distinct color
// names (not the full 140+ CSS named-color table) — the goal is "Red",
// "Green", "Sky blue" at a glance in a right-click menu, not exact CSS
// spec fidelity. Matched by nearest Euclidean RGB distance; falls back
// to the raw hex if nothing is reasonably close (see MAX_DISTANCE),
// rather than mislabeling an odd custom color with a misleading name.
const NAMED_COLORS: { name: string; hex: string }[] = [
	{ name: "Red", hex: "#E03131" },
	{ name: "Pink", hex: "#E64980" },
	{ name: "Grape", hex: "#9C36B5" },
	{ name: "Violet", hex: "#7048E8" },
	{ name: "Indigo", hex: "#4263EB" },
	{ name: "Blue", hex: "#1971C2" },
	{ name: "Sky blue", hex: "#1098AD" },
	{ name: "Teal", hex: "#0CA678" },
	{ name: "Green", hex: "#2F9E44" },
	{ name: "Lime", hex: "#66A80F" },
	{ name: "Yellow", hex: "#F2B705" },
	{ name: "Orange", hex: "#E8590C" },
	{ name: "Brown", hex: "#8B5A2B" },
	{ name: "Gray", hex: "#868E96" },
	{ name: "Black", hex: "#1A1A1A" },
	{ name: "White", hex: "#F8F9FA" },
];

const MAX_DISTANCE = 60; // roughly "clearly a different color" in 0-255-per-channel RGB space

function hexToRgb(hex: string): [number, number, number] | null {
	const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
	if (!m) return null;
	const n = parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Returns a short, human-readable label for a hex color — the nearest
// named color if it's close enough, otherwise the hex itself (so an
// unusual custom color never gets a confidently-wrong name).
export function colorLabel(hex: string): string {
	const rgb = hexToRgb(hex);
	if (!rgb) return hex;
	let best: { name: string; dist: number } | null = null;
	for (const c of NAMED_COLORS) {
		const crgb = hexToRgb(c.hex);
		if (!crgb) continue;
		const dist = Math.sqrt((rgb[0] - crgb[0]) ** 2 + (rgb[1] - crgb[1]) ** 2 + (rgb[2] - crgb[2]) ** 2);
		if (!best || dist < best.dist) best = { name: c.name, dist };
	}
	if (best && best.dist <= MAX_DISTANCE) return best.name;
	return hex;
}
