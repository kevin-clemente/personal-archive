"use client";

import { useMemo, useState } from "react";
import { obsidianNotes } from "./generated-notes";
import { obsidianWatches } from "./generated-watches";

type WatchStatus = "Collection" | "Wishlist" | "Dream";

const watches = [...obsidianWatches] as Array<{
  name: string;
  brand: string;
  status: WatchStatus;
  detail: string;
  reference: string;
  accent: string;
  dial: string;
}>;

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

const filters: Array<"All" | WatchStatus> = [
  "All",
  "Collection",
  "Wishlist",
  "Dream",
];

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

export default function Home() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
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

  return (
    <main className="interface-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Personal archive home">
          <span>[</span>KC<span>]</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#watches"><b>01</b> Watches</a>
          <a href="#notes"><b>02</b> Notes</a>
          <a href="#about"><b>03</b> About</a>
        </nav>
        <a className="header-index" href="#watches">
          <i /> System online <span>↘</span>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span /> Personal knowledge system <b>v.01</b></div>
        <div className="hero-code" aria-hidden="true">SYS.ARCHIVE<br />38.7223° N<br />09.1393° W</div>
        <h1>Personal<br /><em>archive_</em></h1>
        <div className="hero-foot">
          <p>
            A self-hosted index of watches, research,<br />
            field notes and future acquisitions.
          </p>
          <div className="hero-counts" aria-label="Archive totals">
            <div><strong>{String(watches.filter((watch) => watch.status === "Collection").length).padStart(2, "0")}</strong><span>Owned</span></div>
            <div><strong>{String(watches.filter((watch) => watch.status === "Wishlist").length).padStart(2, "0")}</strong><span>Wanted</span></div>
            <div><strong>{String(notes.length).padStart(2, "0")}</strong><span>Notes</span></div>
          </div>
        </div>
      </section>

      <section className="watch-section" id="watches">
        <div className="section-heading">
          <div>
            <span className="section-number">Module_01 / Objects</span>
            <h2>Watch database</h2>
          </div>
          <p>Inventory status: synchronized<br />Records found: {String(watches.length).padStart(3, "0")}</p>
        </div>

        <div className="filter-row" role="group" aria-label="Filter watches">
          {filters.map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item}
              <sup>{item === "All" ? watches.length : watches.filter((w) => w.status === item).length}</sup>
            </button>
          ))}
        </div>

        <div className="watch-grid">
          {visibleWatches.map((watch, index) => (
            <article className="watch-card" key={watch.name}>
              <div className="watch-visual">
                <span className="card-index">OBJ_0{index + 1}</span>
                <span className={`status status-${watch.status.toLowerCase()}`}>{watch.status}</span>
                <WatchFace dial={watch.dial} accent={watch.accent} />
              </div>
              <div className="watch-info">
                <div>
                  <span>{watch.brand}</span>
                  <h3>{watch.name}</h3>
                </div>
                <div className="watch-meta">
                  <span>{watch.detail}</span>
                  <span>Ref. {watch.reference}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="notes-section" id="notes">
        <div className="section-heading notes-heading">
          <div>
            <span className="section-number">Module_02 / Knowledge</span>
            <h2>Memory logs</h2>
          </div>
          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              placeholder="QUERY DATABASE..."
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
        <span className="section-number">Module_03 / System protocol</span>
        <p>
          Built slowly. Kept personally.<br />
          Written in <em>Obsidian</em>, synced with <em>iCloud</em>,<br />
          and published selectively.
        </p>
      </section>

      <footer>
        <a className="wordmark footer-mark" href="#top"><span>[</span>KC<span>]</span></a>
        <p>Node: Lisbon_PT · Status: operational</p>
        <a href="#top">Return to root ↑</a>
      </footer>
    </main>
  );
}
