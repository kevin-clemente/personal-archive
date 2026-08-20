import { access, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

const defaultVault = "/Users/kevinclemente/Library/Mobile Documents/iCloud~md~obsidian/Documents/Kvan";
const vault = resolve(process.env.OBSIDIAN_VAULT_PATH || defaultVault);
const output = resolve("app/generated-notes.ts");
const watchesOutput = resolve("app/generated-watches.ts");

const watchPalette = [
  ["#aab4bb", "#14191d"],
  ["#929da3", "#d7d1bd"],
  ["#7f8b92", "#17191c"],
  ["#8ba4a9", "#183640"],
  ["#8f9caa", "#122d48"],
  ["#a79a86", "#202018"],
  ["#82949c", "#25363d"],
  ["#9aa2a6", "#1e2c3f"],
  ["#b0a590", "#30281c"],
];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)));
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") files.push(path);
  }
  return files;
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) return { data: {}, body: source };
  const end = source.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: source };
  const data = {};
  for (const line of source.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    data[key] = value;
  }
  return { data, body: source.slice(end + 5) };
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.valueOf())
    ? String(value)
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function cleanWatchName(value) {
  return value.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\*\*/g, "").trim();
}

function watchBrand(name) {
  if (name.startsWith("Audemars Piguet")) return "Audemars Piguet";
  return name.split(/\s+/)[0];
}

function blocks(markdown, pattern, status) {
  return [...markdown.matchAll(pattern)].map((match) => {
    const name = cleanWatchName(match.groups.name);
    const body = match.groups.body || "";
    const movement = body.split("\n").find((line) => line.includes("⚙"))?.replace(/^.*?⚙️?\s*/, "").trim();
    const size = body.split("\n").find((line) => line.includes("📏"))?.replace(/^.*?📏\s*/, "").trim();
    const reference = body.match(/\*\*Reference:\*\*\s*(.+)$/m)?.[1]?.trim();
    return { name, brand: watchBrand(name), status, detail: [movement, size].filter(Boolean).join(" · ") || "Details in Obsidian", reference: reference || (status === "Dream" ? "Grail" : "Wishlist") };
  });
}

function extractWatches(markdown) {
  const ownedSection = markdown.match(/## ✅ Watches I Own([\s\S]*?)(?=\n# 🎯 Wishlist)/)?.[1] || "";
  const wishlistSection = markdown.match(/# 🎯 Wishlist([\s\S]*?)(?=\n# 🌟 Dream)/)?.[1] || "";
  const dreamSection = markdown.match(/# 🌟 Dream \/ Grail Watch([\s\S]*?)(?=\n---|\n# 🛒)/)?.[1] || "";
  const owned = blocks(ownedSection, /^###\s+(?<name>.+)\n(?<body>[\s\S]*?)(?=\n---|\n###|(?![\s\S]))/gm, "Collection");
  const wishlist = blocks(wishlistSection, /^### 🔥 Main Choice —\s*(?<name>.+)\n(?<body>[\s\S]*?)(?=\n---|\n## |(?![\s\S]))/gm, "Wishlist");
  const dream = blocks(dreamSection, /^##\s+(?<name>.+)\n(?<body>[\s\S]*?)(?![\s\S])/gm, "Dream");
  return [...owned, ...wishlist, ...dream].map((watch, index) => ({
    ...watch,
    accent: watchPalette[index % watchPalette.length][0],
    dial: watchPalette[index % watchPalette.length][1],
  }));
}

try { await access(vault); } catch { throw new Error(`Obsidian vault not found: ${vault}`); }

const notes = [];
const watches = [];
for (const file of await markdownFiles(vault)) {
  const source = await readFile(file, "utf8");
  const { data, body } = parseFrontmatter(source);
  if (String(data.publish).toLowerCase() !== "true") continue;
  const text = plainText(body);
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const words = text ? text.split(/\s+/).length : 0;
  notes.push({
    category: data.category || "Notes",
    title: data.title || heading || basename(file, ".md"),
    excerpt: data.description || text.slice(0, 180) + (text.length > 180 ? "…" : ""),
    date: displayDate(data.date),
    read: `${Math.max(1, Math.ceil(words / 220))} min`,
    slug: data.slug || basename(file, ".md").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
  });
  if (/My Watch Collection/i.test(data.title || heading || basename(file, ".md"))) {
    watches.push(...extractWatches(body));
  }
}

const generated = `// Generated by npm run sync:obsidian. Do not edit by hand.\nexport const obsidianNotes = ${JSON.stringify(notes, null, 2)} as const;\n`;
await writeFile(output, generated, "utf8");
const generatedWatches = `// Generated by npm run sync:obsidian. Do not edit by hand.\nexport const obsidianWatches = ${JSON.stringify(watches, null, 2)} as const;\n`;
await writeFile(watchesOutput, generatedWatches, "utf8");
console.log(`Imported ${notes.length} published note${notes.length === 1 ? "" : "s"} from ${vault}`);
console.log(`Imported ${watches.length} watches from the published collection`);
