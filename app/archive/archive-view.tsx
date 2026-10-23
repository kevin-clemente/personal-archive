/* eslint-disable @next/next/no-img-element -- product images are pre-optimised by scripts/sync-obsidian.mjs */
"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { obsidianNotes } from "../generated-notes";
import { obsidianWatches, watchPlan } from "../generated-watches";

type WatchStatus = "Collection" | "Wishlist" | "Grail";

type WatchImage = {
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
  fit: "contain" | "cover";
  background: string | null;
  caption: string | null;
  source: string | null;
};

type WatchSpec = { label: string; value: string };

type Watch = {
  slug: string;
  number: number;
  name: string;
  brand: string;
  model: string;
  status: WatchStatus;
  priority: number | string | null;
  priorityRank: number;
  priorityLabel: string;
  categories: string[];
  reference: string | null;
  movement: string | null;
  caseSize: string | null;
  waterResistance: string | null;
  crystal: string | null;
  bracelet: string | null;
  year: string | null;
  madeIn: string | null;
  targetPrice: string | null;
  idealPrice: string | null;
  purchasePrice: string | null;
  summary: string;
  thoughts: string | null;
  personalNotes: string | null;
  purchaseNote: string | null;
  purchaseLead: string | null;
  notes: string[];
  specText: string | null;
  specs: WatchSpec[];
  image: WatchImage | null;
  detail: string;
  accent: string;
  dial: string;
};

type WatchPlanItem = {
  name: string;
  slug: string;
  target: string | null;
  note: string | null;
};

type WatchPriority = WatchPlanItem & { rank: number };

type WatchPlan = {
  overview: string | null;
  priorities: WatchPriority[];
  premium: WatchPlanItem[];
  lower: WatchPlanItem[];
  grail: WatchPlanItem[];
  strategy: string[];
  rules: string[];
};

const watches: Watch[] = [...obsidianWatches] as unknown as Watch[];
const plan: WatchPlan = watchPlan as unknown as WatchPlan;

const sampleNotes = [
  {
    category: "Watch notes",
    title: "What makes a good everyday watch?",
    excerpt:
      "A personal checklist for size, comfort, water resistance and the small details that matter after a month on the wrist.",
    date: "18 Aug 2026",
    read: "4 min",
  },
  {
    category: "Research",
    title: "Integrated bracelets worth trying",
    excerpt:
      "A shortlist before the next visit to a dealer: PRX, Twelve, Ingenieur and the references I want to compare in person.",
    date: "12 Aug 2026",
    read: "6 min",
  },
  {
    category: "Journal",
    title: "Why I started collecting",
    excerpt:
      "Not every object needs to be optimized. Some become markers for a trip, a milestone, or simply a season of life.",
    date: "02 Aug 2026",
    read: "3 min",
  },
];

const notes = obsidianNotes.length > 0 ? [...obsidianNotes] : sampleNotes;

const filters = ["All", "Collection", "Wishlist", "Grail"] as const;
type Filter = (typeof filters)[number];

const filterLabels: Record<Filter, string> = {
  All: "All",
  Collection: "Owned",
  Wishlist: "Wishlist",
  Grail: "Grail",
};

const ownedCount = watches.filter((watch) => watch.status === "Collection").length;
const wishlistCount = watches.filter((watch) => watch.status === "Wishlist").length;
const grailCount = watches.filter((watch) => watch.status === "Grail").length;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function statusLabel(status: WatchStatus): string {
  return status === "Collection" ? "Owned" : status;
}

function WatchFace({ dial, accent }: { dial: string; accent: string }) {
  return (
    <div className="watch-object" aria-hidden="true">
      <span className="watch-strap watch-strap-top" style={{ background: accent }} />
      <span className="watch-strap watch-strap-bottom" style={{ background: accent }} />
      <span className="watch-case" style={{ borderColor: accent }}>
        <span className="watch-dial" style={{ background: dial }}>
          <i className="marker marker-12" />
          <i className="marker marker-3" />
          <i className="marker marker-6" />
          <i className="marker marker-9" />
          <span className="hand hand-hour" />
          <span className="hand hand-minute" />
          <span className="pin" />
        </span>
      </span>
      <span className="crown" style={{ background: accent }} />
    </div>
  );
}

function watchFacts(watch: Watch): Array<{ label: string; value: string }> {
  const facts: Array<{ label: string; value: string } | null> = [
    watch.movement ? { label: "Movement", value: watch.movement } : null,
    watch.caseSize ? { label: "Case", value: watch.caseSize } : null,
    watch.waterResistance ? { label: "Water", value: watch.waterResistance } : null,
    watch.crystal ? { label: "Crystal", value: watch.crystal } : null,
    watch.bracelet ? { label: "Strap", value: watch.bracelet } : null,
  ];
  return facts.filter((fact): fact is { label: string; value: string } => fact !== null);
}

function watchPrice(watch: Watch): { label: string; value: string } | null {
  if (watch.status === "Collection") {
    return watch.purchasePrice ? { label: "Bought", value: watch.purchasePrice } : null;
  }
  if (watch.targetPrice) {
    return {
      label: watch.status === "Grail" ? "Budget" : "Target",
      value: watch.idealPrice ? `${watch.targetPrice} · ${watch.idealPrice}` : watch.targetPrice,
    };
  }
  return {
    label: "Budget",
    value: watch.status === "Grail" ? "No budget recorded" : "No target recorded",
  };
}

function WatchCard({ watch }: { watch: Watch }) {
  const facts = watchFacts(watch);
  const price = watchPrice(watch);
  const image = watch.image;
  const longform = watch.thoughts ?? watch.personalNotes;

  return (
    <article className="watch-card" id={`watch-${watch.slug}`}>
      <div
        className={`watch-visual${image ? " has-image" : ""}${image?.background ? " has-photo-bg" : ""}`}
        style={image?.background ? { backgroundColor: image.background } : undefined}
      >
        <span className="card-index">No. {pad(watch.number)}</span>
        <span className={`status status-${watch.status.toLowerCase()}`}>
          {statusLabel(watch.status)}
        </span>
        {image ? (
          <>
            <img
              className="watch-photo"
              src={image.src}
              alt={image.alt}
              width={image.width ?? undefined}
              height={image.height ?? undefined}
              loading="lazy"
              decoding="async"
            />
            {image.source && (
              <a
                className="watch-source"
                href={image.source}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`Image source for ${watch.name}`}
              >
                Image source ↗
              </a>
            )}
          </>
        ) : (
          <WatchFace dial={watch.dial} accent={watch.accent} />
        )}
      </div>

      <div className="watch-info">
        <div className="watch-heading">
          <div>
            <span className="watch-brand">
              {watch.brand}
              {watch.reference ? ` · Ref. ${watch.reference}` : ""}
            </span>
            <h3>{watch.name}</h3>
          </div>
          {watch.status !== "Collection" && (
            <span className="watch-priority">{watch.priorityLabel}</span>
          )}
        </div>

        {watch.categories.length > 0 && (
          <p className="watch-tags" aria-label="Category">
            {watch.categories.map((category) => (
              <span key={category}>{category}</span>
            ))}
          </p>
        )}

        {facts.length > 0 && (
          <div className="watch-facts">
            {facts.map((fact) => (
              <div key={fact.label}>
                <span>{fact.label}</span>
                <p>{fact.value}</p>
              </div>
            ))}
          </div>
        )}

        {price && (
          <p className="watch-price">
            <span>{price.label}</span>
            {price.value}
          </p>
        )}

        <p className="watch-summary">{watch.summary}</p>

        <details className="watch-details">
          <summary>
            Full specification{watch.notes.length > 0 ? " & notes" : ""}
          </summary>
          <div className="watch-details-body">
            {watch.specs.length > 0 && (
              <dl className="watch-spec-list">
                {watch.specs.map((spec) => (
                  <div key={`${spec.label}-${spec.value}`}>
                    <dt>{spec.label}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {watch.specText && <p className="watch-spec-text">{watch.specText}</p>}
            {longform && (
              <div className="watch-longform">
                <h4>{watch.thoughts ? "My thoughts" : "Personal notes"}</h4>
                <p>{longform}</p>
              </div>
            )}
            {watch.notes.length > 0 && (
              <ul className="watch-note-list">
                {watch.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
            {watch.purchaseNote &&
              !(watch.status === "Collection" && /^Purchase details not recorded/i.test(watch.purchaseNote)) && (
                <p className="watch-purchase-note">{watch.purchaseNote}</p>
              )}
            {image?.caption && (
              <p className="watch-caption">Pictured: {image.caption}</p>
            )}
            {image?.source && (
              <a
                className="watch-source-inline"
                href={image.source}
                target="_blank"
                rel="noreferrer noopener"
              >
                View the image source ↗
              </a>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}

function PurchasePlan({
  plan,
  onJump,
}: {
  plan: WatchPlan;
  onJump: (event: MouseEvent<HTMLAnchorElement>, slug: string) => void;
}) {
  const hasRules = plan.strategy.length > 0 || plan.rules.length > 0;

  return (
    <aside className="watch-plan" id="plan" aria-labelledby="watch-plan-title">
      <div className="plan-intro">
        <span className="section-number">Next acquisitions</span>
        <h3 id="watch-plan-title">The order I’d buy them in.</h3>
        {plan.overview && <p>{plan.overview}</p>}
      </div>

      <div className="plan-content">
        <ol className="plan-list">
          {plan.priorities.map((item) => (
            <li key={item.slug}>
              <span className="plan-rank">{pad(item.rank)}</span>
              <div className="plan-body">
                <div className="plan-head">
                  <a href={`#watch-${item.slug}`} onClick={(event) => onJump(event, item.slug)}>
                    {item.name}
                  </a>
                  <span>{item.target ?? "No target"}</span>
                </div>
                {item.note && <p>{item.note}</p>}
              </div>
            </li>
          ))}
        </ol>

        <div className="plan-groups">
          {plan.premium.length > 0 && (
            <p>
              <span>Premium</span>
              {plan.premium.map((item, index) => (
                <span key={item.slug}>
                  {index > 0 && " · "}
                  <a href={`#watch-${item.slug}`} onClick={(event) => onJump(event, item.slug)}>
                    {item.name}
                  </a>
                </span>
              ))}
            </p>
          )}
          {plan.lower.length > 0 && (
            <p>
              <span>Alternatives</span>
              {plan.lower.map((item, index) => (
                <span key={item.slug}>
                  {index > 0 && " · "}
                  <a href={`#watch-${item.slug}`} onClick={(event) => onJump(event, item.slug)}>
                    {item.name}
                  </a>
                </span>
              ))}
            </p>
          )}
          {plan.grail.length > 0 && (
            <p>
              <span>Grail</span>
              {plan.grail.map((item, index) => (
                <span key={item.slug}>
                  {index > 0 && " · "}
                  <a href={`#watch-${item.slug}`} onClick={(event) => onJump(event, item.slug)}>
                    {item.name}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>

        {hasRules && (
          <details className="plan-rules">
            <summary>How I collect</summary>
            <div>
              {plan.strategy.length > 0 && (
                <>
                  <h4>Strategy</h4>
                  <ul>
                    {plan.strategy.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
              {plan.rules.length > 0 && (
                <>
                  <h4>Rules</h4>
                  <ul>
                    {plan.rules.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </details>
        )}
      </div>
    </aside>
  );
}

export default function ArchiveView() {
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const visibleWatches = useMemo(
    () => watches.filter((watch) => filter === "All" || watch.status === filter),
    [filter],
  );

  const visibleNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;
    return notes.filter((note) =>
      [note.title, note.excerpt, note.category].join(" ").toLowerCase().includes(normalized),
    );
  }, [query]);

  function jumpToWatch(event: MouseEvent<HTMLAnchorElement>, slug: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setFilter("All");
    window.setTimeout(() => {
      document.getElementById(`watch-${slug}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }

  return (
    <main className="interface-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Back to the dashboard">
          KC<span>°</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="/">Dashboard</a>
          <a href="#watches">Watches</a>
          <a href="#plan">Plan</a>
          <a href="#notes">Notes</a>
          <a href="#about">About</a>
        </nav>
        <a className="header-index" href="#watches">
          <i /> Synced with Obsidian <span>↘</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> Personal archive <b>Since 2026</b></div>
        <div className="hero-code" aria-hidden="true">Lisbon, Portugal<br />38.7223° N · 09.1393° W</div>
        <h1>Things worth<br /><em>keeping close.</em></h1>
        <div className="hero-foot">
          <p>
            Watches collected, pieces still dreamt of,<br />
            and notes gathered along the way.
          </p>
          <div className="hero-counts" aria-label="Archive totals">
            <div><strong>{pad(ownedCount)}</strong><span>Owned</span></div>
            <div><strong>{pad(wishlistCount)}</strong><span>Wishlist</span></div>
            <div><strong>{pad(grailCount)}</strong><span>Grail</span></div>
            <div><strong>{pad(notes.length)}</strong><span>Notes</span></div>
          </div>
        </div>
      </section>

      <section className="watch-section" id="watches">
        <div className="section-heading">
          <div>
            <span className="section-number">01 · The collection</span>
            <h2>Watches, with stories.</h2>
          </div>
          <p>
            {ownedCount} owned · {wishlistCount} wanted · {grailCount} grail.<br />
            Every specification, target and note.
          </p>
        </div>

        <div className="filter-row" role="group" aria-label="Filter watches">
          {filters.map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
              type="button"
              aria-pressed={filter === item}
              aria-label={`${filterLabels[item]} (${item === "All" ? watches.length : watches.filter((watch) => watch.status === item).length})`}
            >
              {filterLabels[item]}
              <sup>{item === "All" ? watches.length : watches.filter((watch) => watch.status === item).length}</sup>
            </button>
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          {visibleWatches.length} watch{visibleWatches.length === 1 ? "" : "es"} shown.
        </p>

        <div className="watch-grid">
          {visibleWatches.map((watch) => (
            <WatchCard key={watch.slug} watch={watch} />
          ))}
        </div>

        <PurchasePlan plan={plan} onJump={jumpToWatch} />
      </section>

      <section className="notes-section" id="notes">
        <div className="section-heading notes-heading">
          <div>
            <span className="section-number">02 · Notes & thoughts</span>
            <h2>From the notebook.</h2>
          </div>
          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Search notes..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search notes"
            />
          </label>
        </div>

        <div className="notes-list" aria-live="polite">
          {visibleNotes.map((note, index) => (
            <article className="note-row" key={note.title}>
              <span className="note-number">0{index + 1}</span>
              <div className="note-main">
                <span className="note-category">{note.category}</span>
                <h3>{note.title}</h3>
                <p>{note.excerpt}</p>
              </div>
              <div className="note-meta">
                <span>{note.date}</span>
                <span>{note.read} read</span>
              </div>
              <span className="note-arrow" aria-hidden="true">↗</span>
            </article>
          ))}
          {visibleNotes.length === 0 && (
            <p className="empty-state">No notes match “{query}”.</p>
          )}
        </div>
      </section>

      <section className="about-section" id="about">
        <span className="section-number">03 · About this place</span>
        <p>
          Built slowly. Kept personally.<br />
          Written in <em>Obsidian</em>, synced with <em>iCloud</em>,<br />
          and published selectively.
        </p>
      </section>

      <footer>
        <a className="wordmark footer-mark" href="/" aria-label="Back to the dashboard">KC<span>°</span></a>
        <p>Personal archive · Lisbon, Portugal</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
