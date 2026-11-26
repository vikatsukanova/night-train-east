import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const dist = new URL("../dist/", import.meta.url);
const manifest = JSON.parse(
	readFileSync(new URL(".vite/manifest.json", dist), "utf8"),
);
const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
if (!entries.length) throw new Error("Vite manifest has no entry.");

const initial = new Set(["index.html"]);
const visited = new Set();
function collect(key) {
	if (visited.has(key)) return;
	visited.add(key);
	const chunk = manifest[key];
	if (!chunk) throw new Error(`Missing Vite manifest entry: ${key}`);
	initial.add(chunk.file);
	for (const file of chunk.css ?? []) initial.add(file);
	for (const file of chunk.assets ?? []) initial.add(file);
	for (const imported of chunk.imports ?? []) collect(imported);
}

for (const entry of entries) collect(entry);

let initialJs = 0;
let initialAssets = 0;
for (const file of initial) {
	const bytes = readFileSync(new URL(file, dist));
	if (/\.[cm]?js$/.test(file)) initialJs += gzipSync(bytes).length;
	else initialAssets += bytes.length;
}

function directoryBytes(path) {
	return readdirSync(path, { withFileTypes: true }).reduce((sum, entry) => {
		const child = join(entry.parentPath, entry.name);
		return (
			sum + (entry.isDirectory() ? directoryBytes(child) : statSync(child).size)
		);
	}, 0);
}

const budgets = [
	["Initial JS (gzip)", initialJs, 750 * 1024],
	["Initial non-JS", initialAssets, 22_000_000],
	["Total dist", directoryBytes(dist), 25_000_000],
];
console.table(
	budgets.map(([measure, bytes, limit]) => ({ measure, bytes, limit })),
);
if (budgets.some(([, bytes, limit]) => bytes > limit)) process.exitCode = 1;
