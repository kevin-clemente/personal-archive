import { access, copyFile, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

const defaultVault = "/Users/kevinclemente/Library/Mobile Documents/iCloud~md~obsidian/Documents/Kvan";
const vault = resolve(process.env.OBSIDIAN_VAULT_PATH || defaultVault);
const output = resolve("app/generated-notes.ts");
const watchesOutput = resolve("app/generated-watches.ts");
const imagesDirectory = resolve("public/watches");

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
  ["#b7a7a0", "#2a1d1c"],
  ["#9baa9a", "#1b2a1b"],
  ["#a9a0b5", "#241d2a"],
];

const statusLabels = {
  owned: "Collection",
  wishlist: "Wishlist",
  grail: "Grail",
};

const statusOrder = { Collection: 0, Wishlist: 1, Grail: 2 };

const movementLabels = {
  automatic: "Automatic",
  quartz: "Quartz",
  manual: "Manual wind",
  "manual-wind": "Manual wind",
  handwound: "Manual wind",
  "hand-wound": "Manual wind",
  spring: "Spring drive",
  unknown: null,
};

const braceletLabels = {
  steel: "Steel bracelet",
  leather: "Leather strap",
  textile: "Textile strap",
  nato: "NATO strap",
  rubber: "Rubber strap",
};

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

function parseValue(raw) {
  const value = raw.trim();
  if (!value || value === "null" || value === "~") return null;
  if (value.startsWith("[") && value.endsWith("]")) {
    return value
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
  }
  const unquoted = value.replace(/^['"]|['"]$/g, "");
  if (/^-?\d+(?:\.\d+)?$/.test(unquoted)) return Number(unquoted);
  return unquoted;
}

function parseFrontmatter(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, body: normalized };
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) return { data: {}, body: normalized };
  const data = {};
  for (const line of normalized.slice(4, end).split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    if (!key) continue;
    data[key] = parseValue(line.slice(separator + 1));
  }
  return { data, body: normalized.slice(end + 5) };
}

function plainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[\[[^\]]*\]\]/g, " ")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, path) => path.split("/").pop())
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/^[\s>*#-]+/gm, "")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanHeading(value) {
  return value
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function section(markdown, name) {
  const lines = markdown.split("\n");
  const wanted = cleanHeading(name);
  const start = lines.findIndex((line) => {
    if (!/^#{1,6}\s/.test(line)) return false;
    const heading = cleanHeading(line.replace(/^#{1,6}\s*/, ""));
    return heading === wanted || heading.endsWith(` ${wanted}`);
  });
  if (start === -1) return "";
  const level = lines[start].match(/^#+/)[0].length;
  const collected = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const heading = lines[index].match(/^(#{1,6})\s/);
    if (heading && heading[1].length <= level) break;
    if (/Back to Watch Collection/i.test(lines[index])) continue;
    collected.push(lines[index]);
  }
  return collected.join("\n");
}

function tableRows(markdown) {
  const rows = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line))
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
  if (rows.length === 0) return [];
  return rows
    .slice(1)
    .map(([label, ...rest]) => ({
      label: plainText(label ?? ""),
      value: plainText(rest.join(" ")),
    }))
    .filter((row) => row.label && row.value);
}

// Some notes describe specs as `- Label: value` bullets instead of a table.
// Treat those as spec rows so cards get the same structured detail view.
const BULLET_SPEC = /^\s*[-*]\s+([A-Za-z][A-Za-z0-9 /&()'.—-]{0,40}):\s+(.+)$/;

function bulletSpecs(markdown) {
  return markdown
    .split("\n")
    .map((line) => line.match(BULLET_SPEC))
    .filter(Boolean)
    .map((match) => ({
      label: plainText(match[1]),
      value: plainText(match[2]).replace(/[.;]+$/, ""),
    }))
    .filter((row) => row.label && row.value);
}

function bullets(markdown) {
  return markdown
    .split("\n")
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) => plainText(line.replace(/^\s*[-*]\s+/, "").replace(/^\[[ xX]\]\s*/, "")))
    .filter(Boolean);
}

function firstParagraph(markdown) {
  const paragraphs = markdown
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  for (const paragraph of paragraphs) {
    if (/^[|#>-]/.test(paragraph)) continue;
    const text = plainText(paragraph);
    if (text) return text;
  }
  return "";
}

function limitText(value, maxLength) {
  if (!value) return "";
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (lastStop > maxLength * 0.55) return cut.slice(0, lastStop + 1);
  return `${cut.replace(/[,;:\s]+$/, "")}…`;
}

function displayDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.valueOf())
    ? String(value)
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function titleCase(value) {
  if (value === "gmt") return "GMT";
  if (value === "iwc") return "IWC";
  return value.replace(/(^|[\s-])(\p{L})/gu, (_, separator, letter) => `${separator}${letter.toUpperCase()}`);
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Number(value));
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  if (lower.startsWith("around ")) return `Around €${formatNumber(lower.slice(7))}`;
  if (lower.startsWith("under ")) return `Under €${formatNumber(lower.slice(6))}`;
  if (lower.startsWith("~")) return `~€${formatNumber(lower.replace(/^~/, ""))}`;
  const range = raw.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) return `€${formatNumber(range[1])}–${formatNumber(range[2])}`;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return `€${formatNumber(raw)}`;
  return raw;
}

function excellentPrice(value) {
  const price = formatPrice(value);
  return price ? `≤ ${price} ideal` : null;
}

// Spec values are sometimes full sentences ("Rated 50 m / 5 ATM; current seal
// condition not recorded"). The card shows a short chip; the expanded details
// keep the complete value, so collapse to the first clause and cap the length.
function chipValue(value) {
  if (!value) return value;
  const cleaned = value.replace(/\s+/g, " ").replace(/[.;]+$/, "").trim();
  const clause = cleaned.split(/;\s|,\s/)[0]?.trim() ?? cleaned;
  const cased = clause.charAt(0).toUpperCase() + clause.slice(1);
  if (cased.length <= 52) return cased;
  return `${cased.slice(0, 52).replace(/[\s,;:–-]+\S*$/, "")}…`;
}

function findSpec(specs, pattern) {
  return specs.find((spec) => pattern.test(spec.label))?.value ?? null;
}

function watchName(data, heading) {
  const brand = typeof data.brand === "string" ? data.brand.trim() : "";
  const model = typeof data.model === "string" ? data.model.trim() : "";
  if (brand && model) return `${brand} ${model}`;
  if (heading) return plainText(heading);
  return model || brand || "Watch";
}

function priorityLabel(priority, status) {
  if (status === "Collection") return "Owned";
  if (status === "Grail") return "Ultimate goal";
  if (typeof priority === "number") {
    if (priority === 1) return "Next purchase";
    return `Priority #${priority}`;
  }
  if (priority === "premium") return "Premium target";
  if (priority === "low") return "Low priority";
  if (priority === "alternative") return "Alternative";
  if (priority === "undecided") return "Undecided";
  return "Wishlist";
}

function priorityRank(priority, status) {
  if (status === "Collection") return 0;
  if (typeof priority === "number") return priority;
  if (priority === "premium") return 5;
  if (priority === "low") return 6;
  if (priority === "alternative") return 7;
  return 8;
}

function findImage(body) {
  const embed = body.match(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/);
  if (!embed) return null;
  const lines = body.split("\n");
  const lineIndex = lines.findIndex((line) => line.includes(embed[0]));
  const nextLine = lines.slice(lineIndex + 1).find((line) => line.trim());
  const source = nextLine?.match(/\[Image source\]\((https?:\/\/[^)]+)\)/)?.[1] ?? null;
  const caption = nextLine
    ? plainText(nextLine.replace(/\[Image source\]\([^)]*\)/g, ""))
        .replace(/^[.\s]+/, "")
        .replace(/\s+$/, "")
        .replace(/(?:\.\s*){2,}$/, ".")
    : "";
  return {
    path: embed[1].trim(),
    caption: caption || null,
    source,
  };
}

async function prepareImage(imagePath, slug, alt) {
  const source = resolve(vault, imagePath);
  try {
    await access(source);
  } catch {
    console.warn(`  ! image not found: ${imagePath}`);
    return null;
  }

  await mkdir(imagesDirectory, { recursive: true });
  const destination = join(imagesDirectory, `${slug}.webp`);

  try {
    const sharp = (await import("sharp")).default;
    const stats = await sharp(source).stats();
    const alpha = stats.channels[3];
    const transparent = Boolean(alpha && alpha.min < 250);
    const [red, green, blue] = stats.channels;
    let background = null;
    if (!transparent) {
      // Sample the border rather than the whole frame so letterboxing blends
      // with the photo instead of with the watch itself.
      const edge = await sharp(source)
        .resize(8, 8, { fit: "fill" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          if (x !== 0 && y !== 0 && x !== 7 && y !== 7) continue;
          const offset = (y * 8 + x) * edge.info.channels;
          if (edge.info.channels === 4 && edge.data[offset + 3] < 10) continue;
          r += edge.data[offset];
          g += edge.data[offset + 1];
          b += edge.data[offset + 2];
          count += 1;
        }
      }
      background = count
        ? `rgb(${Math.round(r / count)} ${Math.round(g / count)} ${Math.round(b / count)})`
        : `rgb(${Math.round(red.mean)} ${Math.round(green.mean)} ${Math.round(blue.mean)})`;
    }
    const info = await sharp(source)
      .rotate()
      .resize({ width: 1100, height: 1100, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, alphaQuality: 90, effort: 4 })
      .toFile(destination);
    return {
      src: `/watches/${slug}.webp`,
      width: info.width,
      height: info.height,
      alt,
      fit: "contain",
      background,
    };
  } catch (error) {
    console.warn(`  ! could not optimise ${imagePath}: ${error.message}`);
    const fallback = join(imagesDirectory, `${slug}${extname(source).toLowerCase()}`);
    await copyFile(source, fallback);
    return {
      src: `/watches/${basename(fallback)}`,
      width: null,
      height: null,
      alt,
      fit: "contain",
      background: null,
    };
  }
}

async function extractWatches(files) {
  const watches = [];
  let indexBody = "";

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const { data, body } = parseFrontmatter(source);
    const fileTitle = basename(file, ".md");

    if (
      data.type === "collection-index" ||
      /^00\s*[-–]\s*watch collection$/i.test(fileTitle) ||
      (typeof data.title === "string" && /^watch collection$/i.test(data.title) && !data.status)
    ) {
      indexBody = body;
      continue;
    }

    const rawStatus =
      typeof data.status === "string" ? data.status.toLowerCase() : null;
    const pathStatus = /\/owned\//i.test(file) ? "owned" : /\/wishlist\//i.test(file) ? "wishlist" : /\/grail\//i.test(file) ? "grail" : null;
    const status = statusLabels[rawStatus ?? pathStatus];
    if (!status) continue;

    const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
    const name = watchName(data, heading);
    const slug = slugify(name);
    const specSection = section(body, "Specifications");
    const tableSpecs = tableRows(specSection);
    const specs = tableSpecs.length > 0 ? tableSpecs : bulletSpecs(specSection);
    const specText = specSection
      ? plainText(
          specSection
            .split("\n")
            .filter((line) => !line.trim().startsWith("|") && !BULLET_SPEC.test(line))
            .join("\n"),
        )
      : "";

    const categories = Array.isArray(data.category)
      ? data.category.map((item) => titleCase(String(item)))
      : [];

    const reference =
      typeof data.reference === "string" && data.reference.trim()
        ? data.reference.trim()
        : null;

    const movementSpec = chipValue(findSpec(specs, /movement/i));
    const movementFromText = /micro-rotor/i.test(specText)
      ? "Automatic micro-rotor"
      : /Powermatic 80/i.test(specText)
        ? "Powermatic 80 automatic"
        : /Miyota 9075/i.test(specText)
          ? "Miyota 9075 automatic"
          : /manual-wind/i.test(specText)
            ? "Manual wind"
            : null;
    const movementKey = typeof data.movement === "string" ? data.movement.toLowerCase() : null;
    const movementFromFrontmatter = movementKey
      ? Object.hasOwn(movementLabels, movementKey)
        ? movementLabels[movementKey]
        : titleCase(movementKey)
      : null;
    const movement = movementSpec ?? movementFromText ?? movementFromFrontmatter;

    const caseRaw =
      findSpec(specs, /^(case|case diameter|case size)$/i) ??
      findSpec(specs, /case (diameter|size)/i);
    // Case rows often describe materials too ("18 ct 5N gold, 44.2 mm"), so
    // prefer an explicit measurement when the row contains one.
    const caseMm =
      caseRaw?.match(/(\d+(?:\.\d+)?)\s*mm/i)?.[1] ??
      specText.match(/(\d+(?:\.\d+)?)\s*mm/i)?.[1];
    const caseSize =
      typeof data.case_size_mm === "number"
        ? `${data.case_size_mm} mm`
        : caseMm
          ? `${caseMm} mm`
          : chipValue(caseRaw);

    const waterResistance =
      chipValue(findSpec(specs, /water resistance/i)) ??
      (typeof data.water_resistance_m === "number" ? `${data.water_resistance_m} m` : null);

    const crystalFromText = specText.match(/\b(sapphire|mineral|acrylic|hesalite)\b/i)?.[1];
    const crystal =
      chipValue(findSpec(specs, /crystal/i)) ??
      (typeof data.crystal === "string"
        ? titleCase(data.crystal)
        : crystalFromText
          ? titleCase(crystalFromText)
          : null);

    const braceletFromText = /steel bracelet/i.test(specText)
      ? "Steel bracelet"
      : /textile|nato|canvas/i.test(specText)
        ? "Textile / leather"
        : /leather strap/i.test(specText)
          ? "Leather strap"
          : null;
    const bracelet =
      chipValue(findSpec(specs, /^(bracelet|strap)$/i)) ??
      braceletFromText ??
      (typeof data.bracelet === "string" ? braceletLabels[data.bracelet.toLowerCase()] ?? titleCase(data.bracelet) : null);

    const year =
      chipValue(findSpec(specs, /^(year|period)$/i)) ??
      (typeof data.year === "number" ? String(data.year) : null);

    const madeIn =
      chipValue(findSpec(specs, /^(made in|origin)$/i)) ??
      (typeof data.made_in === "string" ? titleCase(data.made_in) : null);

    const purchaseSection = section(body, "Purchase");
    const purchaseNote = plainText(purchaseSection);
    const purchaseLead = limitText(firstParagraph(purchaseSection), 260);

    const summary = limitText(
      firstParagraph(section(body, "My Thoughts")) ||
        firstParagraph(section(body, "Personal Notes")) ||
        purchaseLead ||
        limitText(specText, 180) ||
        "Details in Obsidian.",
      210,
    );

    const notes = bullets(section(body, "Notes"));
    const thoughts = firstParagraph(section(body, "My Thoughts"));
    const personalNotes = firstParagraph(section(body, "Personal Notes"));

    const targetPrice = formatPrice(data.target_price_eur);
    const idealPrice = excellentPrice(data.excellent_price_eur);

    let purchasePrice = null;
    if (typeof data.purchase_price_eur === "number") {
      const hammer = formatPrice(data.purchase_price_eur);
      const total = typeof data.total_cost_eur === "number" ? formatPrice(data.total_cost_eur) : null;
      purchasePrice = total ? `${hammer} · ${total} all-in` : hammer;
    }

    const image = findImage(body);
    const alt = image?.caption
      ? `${name} — ${limitText(image.caption, 180)}`
      : `${name} — product photo`;

    watches.push({
      slug,
      number: 0,
      name,
      brand: typeof data.brand === "string" ? data.brand : name.split(" ")[0],
      model: typeof data.model === "string" ? data.model : name,
      status,
      priority: data.priority ?? null,
      priorityRank: priorityRank(data.priority, status),
      priorityLabel: priorityLabel(data.priority, status),
      categories,
      reference,
      movement,
      caseSize,
      waterResistance,
      crystal,
      bracelet,
      year,
      madeIn,
      targetPrice,
      idealPrice,
      purchasePrice,
      summary,
      thoughts: thoughts || null,
      personalNotes: personalNotes || null,
      purchaseNote: purchaseNote || null,
      purchaseLead: purchaseLead || null,
      notes,
      specText: specText || null,
      specs,
      image: image
        ? {
            ...image,
            alt,
            src: null,
            width: null,
            height: null,
            fit: "contain",
            background: null,
          }
        : null,
      detail: [movement, caseSize].filter(Boolean).join(" · ") || "Details in Obsidian",
      accent: "",
      dial: "",
    });
  }

  watches.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      a.priorityRank - b.priorityRank ||
      a.name.localeCompare(b.name),
  );

  await Promise.all(
    watches.map(async (watch, index) => {
      watch.number = index + 1;
      const palette = watchPalette[index % watchPalette.length];
      watch.accent = palette[0];
      watch.dial = palette[1];
      if (watch.image) {
        const prepared = await prepareImage(watch.image.path, watch.slug, watch.image.alt);
        watch.image = prepared
          ? {
              ...prepared,
              caption: watch.image.caption,
              source: watch.image.source,
            }
          : null;
      }
    }),
  );

  const priorities = watches
    .filter((watch) => typeof watch.priority === "number" && watch.priority >= 1 && watch.priority <= 4)
    .map((watch) => ({
      rank: watch.priority,
      name: watch.name,
      slug: watch.slug,
      target: watch.targetPrice,
      note: watch.purchaseLead || watch.summary,
    }));

  const premium = watches
    .filter((watch) => watch.priority === "premium")
    .map((watch) => ({
      name: watch.name,
      slug: watch.slug,
      target: watch.targetPrice,
      note: watch.purchaseLead || watch.summary,
    }));

  const lower = watches
    .filter((watch) => watch.priority === "low" || watch.priority === "alternative")
    .map((watch) => ({
      name: watch.name,
      slug: watch.slug,
      target: watch.targetPrice,
      note: watch.purchaseLead || watch.summary,
    }));

  const grail = watches
    .filter((watch) => watch.status === "Grail")
    .map((watch) => ({
      name: watch.name,
      slug: watch.slug,
      target: watch.targetPrice,
      note: watch.purchaseLead || watch.summary,
    }));

  const watchPlan = {
    overview: firstParagraph(section(indexBody, "Collection overview")) || null,
    priorities,
    premium,
    lower,
    grail,
    strategy: bullets(section(indexBody, "Collection strategy")),
    rules: bullets(section(indexBody, "Collecting rules")),
  };

  return { watches, watchPlan };
}

async function pruneImages(watches) {
  let files;
  try {
    files = await readdir(imagesDirectory);
  } catch {
    return;
  }
  const keep = new Set(
    watches
      .map((watch) => watch.image?.src)
      .filter(Boolean)
      .map((src) => basename(src)),
  );
  for (const file of files) {
    if (!file.toLowerCase().endsWith(".webp")) continue;
    if (keep.has(file)) continue;
    await unlink(join(imagesDirectory, file));
  }
}

try {
  await access(vault);
} catch {
  throw new Error(`Obsidian vault not found: ${vault}`);
}

const files = await markdownFiles(vault);
const notes = [];
let watchResult = { watches: [], watchPlan: null };

for (const file of files) {
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
}

watchResult = await extractWatches(files);
await pruneImages(watchResult.watches);

if (notes.length > 0) {
  const generated = `// Generated by npm run sync:obsidian. Do not edit by hand.\nexport const obsidianNotes = ${JSON.stringify(notes, null, 2)} as const;\n`;
  await writeFile(output, generated, "utf8");
} else {
  console.log("No published notes found; left app/generated-notes.ts unchanged.");
}

const generatedWatches = `// Generated by npm run sync:obsidian. Do not edit by hand.\nexport const obsidianWatches = ${JSON.stringify(watchResult.watches, null, 2)} as const;\nexport const watchPlan = ${JSON.stringify(watchResult.watchPlan, null, 2)} as const;\n`;
await writeFile(watchesOutput, generatedWatches, "utf8");

console.log(`Imported ${notes.length} published note${notes.length === 1 ? "" : "s"} from ${vault}`);
console.log(`Imported ${watchResult.watches.length} watches and ${watchResult.watches.filter((watch) => watch.image).length} images from the published collection`);
