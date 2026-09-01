/**
 * Regenerates every raster brand/PWA asset from the single vector source
 * (logo/logo.svg). Run with: bun run assets:icons
 *
 * Each PNG is rasterised natively at its final pixel size — nothing is
 * produced by up- or down-scaling another bitmap, which is what makes the
 * installed PWA icon look soft on high-density phone screens.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "logo", "logo.svg");
const publicDir = join(root, "public");
const logoDir = join(root, "logo");

/** Brand mint — must match the background rect inside logo.svg. */
const MINT = { r: 0xdd, g: 0xff, b: 0xf7, alpha: 1 };

/** logo.svg is authored on a 1000x1000 canvas. */
const SVG_CANVAS = 1000;

/**
 * Rasterise the vector at exactly `size` device pixels. librsvg renders at
 * `canvas * density / 72`, so we solve for the density that lands on `size`
 * and let the vector renderer do the anti-aliasing rather than a resampler.
 */
function render(size) {
	return sharp(source, { density: (72 * size) / SVG_CANVAS }).resize(
		size,
		size,
		{ fit: "cover" },
	);
}

/**
 * Android applies an adaptive-icon mask that can crop the outer 10% on every
 * side and then scales what is left up to the launcher's icon size. Drawing
 * the mark at 70% keeps the whole thing inside the safe circle, and rendering
 * the padded canvas at full size keeps it sharp after that upscale.
 */
async function renderMaskable(size) {
	const inner = Math.round(size * 0.7);
	const mark = await render(inner).png().toBuffer();
	return sharp({
		create: {
			width: size,
			height: size,
			channels: 4,
			background: MINT,
		},
	}).composite([
		{
			input: mark,
			top: Math.round((size - inner) / 2),
			left: Math.round((size - inner) / 2),
		},
	]);
}

/** Minimal PNG-in-ICO container (understood by every browser and Windows Vista+). */
function encodeIco(pngs) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(pngs.length, 4);

	let offset = 6 + pngs.length * 16;
	const entries = [];
	for (const { size, data } of pngs) {
		const entry = Buffer.alloc(16);
		entry.writeUInt8(size >= 256 ? 0 : size, 0);
		entry.writeUInt8(size >= 256 ? 0 : size, 1);
		entry.writeUInt8(0, 2); // palette size
		entry.writeUInt8(0, 3); // reserved
		entry.writeUInt16LE(1, 4); // colour planes
		entry.writeUInt16LE(32, 6); // bits per pixel
		entry.writeUInt32LE(data.length, 8);
		entry.writeUInt32LE(offset, 12);
		offset += data.length;
		entries.push(entry);
	}

	return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const png = { compressionLevel: 9, palette: false };

const targets = [
	// PWA — "any" purpose. 1024 exists so the install prompt and splash screen
	// have real pixels to work with on 3x/4x displays.
	{ file: join(publicDir, "pwa-192x192.png"), size: 192 },
	{ file: join(publicDir, "pwa-512x512.png"), size: 512 },
	{ file: join(publicDir, "pwa-1024x1024.png"), size: 1024 },
	// Apple home screen.
	{ file: join(publicDir, "apple-touch-icon.png"), size: 180 },
	// Favicons.
	{ file: join(publicDir, "favicon-16x16.png"), size: 16 },
	{ file: join(publicDir, "favicon-32x32.png"), size: 32 },
	// Raster logo, for anywhere the SVG can't be used.
	{ file: join(logoDir, "logo.png"), size: 1000 },
];

const maskableTargets = [
	{ file: join(publicDir, "pwa-maskable-192x192.png"), size: 192 },
	{ file: join(publicDir, "pwa-maskable-512x512.png"), size: 512 },
	{ file: join(publicDir, "pwa-maskable-1024x1024.png"), size: 1024 },
];

await mkdir(publicDir, { recursive: true });

for (const { file, size } of targets) {
	await render(size).png(png).toFile(file);
	console.log(`${file}  ${size}x${size}`);
}

for (const { file, size } of maskableTargets) {
	await (await renderMaskable(size)).png(png).toFile(file);
	console.log(`${file}  ${size}x${size} (maskable)`);
}

const icoSizes = [16, 32, 48, 64, 128, 256];
const icoPngs = [];
for (const size of icoSizes) {
	icoPngs.push({ size, data: await render(size).png(png).toBuffer() });
}
await writeFile(join(publicDir, "favicon.ico"), encodeIco(icoPngs));
console.log(`${join(publicDir, "favicon.ico")}  ${icoSizes.join("/")}`);

// logo.svg is an Affinity Designer export and gets overwritten whenever the
// artwork is re-exported, so normalise a copy rather than editing it in place:
// give it real pixel dimensions (the export uses width/height="100%", which
// some browsers collapse to nothing when the SVG is used as a favicon) and an
// accessible title.
const vector = await readFile(source, "utf8");
const favicon = vector
	.replace(/<\?xml[^>]*\?>\s*/, "")
	.replace(/<!DOCTYPE[^>]*>\s*/, "")
	.replace(
		/\swidth="100%"\sheight="100%"/,
		` width="${SVG_CANVAS}" height="${SVG_CANVAS}" role="img"`,
	)
	.replace(/(<svg[^>]*>)/, "$1\n    <title>lets-talie logo</title>");
await writeFile(join(publicDir, "favicon.svg"), favicon);
console.log(`${join(publicDir, "favicon.svg")}  vector`);
