"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./components/icons";
import { destinations, owner } from "./dashboard-config";
import { obsidianNotes } from "./generated-notes";
import { obsidianWatches } from "./generated-watches";
import type { PiholeOffline, PiholeOnline, PiholeState } from "./pihole-types";

type WatchStatus = "Collection" | "Wishlist" | "Grail";

type Watch = {
  name: string;
  brand: string;
  status: WatchStatus;
  detail: string;
  reference: string | null;
  accent: string;
  dial: string;
};

type Note = {
  category: string;
  title: string;
  excerpt: string;
  date: string;
  read: string;
  slug: string;
};

const watches: Watch[] = [...obsidianWatches] as unknown as Watch[];
const notes: Note[] = [...obsidianNotes];

const owned = watches.filter((watch) => watch.status === "Collection");
const wishlist = watches.filter((watch) => watch.status === "Wishlist");
const grail = watches.filter((watch) => watch.status === "Grail");

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: owner.timeZone,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Node and Chrome ship different ICU data; joining the parts keeps the
// server HTML and the hydrated client text identical.
function formatLongDate(date: Date): string {
  const parts = dateFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return [value("weekday"), value("day"), value("month"), value("year")]
    .filter(Boolean)
    .join(" ");
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: owner.timeZone,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: owner.timeZone,
  hour: "numeric",
  hourCycle: "h23",
});

const numberFormatter = new Intl.NumberFormat("en-GB");

type Tone = "ok" | "error" | "wait" | "idle";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const THEME_EVENT = "kc-theme-change";

function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  return () => window.removeEventListener(THEME_EVENT, onChange);
}

function themeSnapshot(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function serverThemeSnapshot(): "light" | "dark" {
  return "light";
}

function PiholeSkeleton() {
  return (
    <div className="dash-pihole-loading" role="status">
      <span className="sr-only">Checking Pi-hole…</span>
      <div className="dash-gauge-skeleton" aria-hidden="true" />
      <div className="dash-lines-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function PiholeLive({
  data,
  onRefresh,
}: {
  data: PiholeOnline;
  onRefresh: () => void;
}) {
  const percent = Math.min(100, Math.max(0, data.percentBlocked));

  return (
    <>
      <div className="dash-pihole-live">
        <div
          className="dash-gauge"
          style={{
            background: `conic-gradient(var(--dash-ok) ${percent}%, var(--dash-line) 0)`,
          }}
          aria-hidden="true"
        >
          <div className="dash-gauge-inner">
            <strong>{formatPercent(data.percentBlocked)}</strong>
            <span>blocked</span>
          </div>
        </div>
        <span className="sr-only">
          {formatPercent(data.percentBlocked)} of DNS queries are blocked today.
        </span>
        <dl className="dash-pihole-stats">
          <div>
            <dt>Queries</dt>
            <dd>{formatNumber(data.queries)}</dd>
          </div>
          <div>
            <dt>Blocked</dt>
            <dd>{formatNumber(data.blocked)}</dd>
          </div>
          <div>
            <dt>Domains</dt>
            <dd>
              {data.gravityDomains === null
                ? "—"
                : formatNumber(data.gravityDomains)}
            </dd>
          </div>
          <div>
            <dt>As of</dt>
            <dd>{timeFormatter.format(new Date(data.fetchedAt))}</dd>
          </div>
        </dl>
      </div>
      <div className="dash-pihole-foot">
        {data.adminUrl ? (
          <a href={data.adminUrl} target="_blank" rel="noreferrer">
            Open admin <Icon name="external" size={13} />
          </a>
        ) : (
          <span>Admin link unavailable</span>
        )}
        <button type="button" onClick={onRefresh}>
          Refresh <Icon name="refresh" size={13} />
        </button>
      </div>
    </>
  );
}

function PiholeUnavailable({
  configured,
  error,
  adminUrl,
  onRetry,
}: {
  configured: boolean;
  error?: string;
  adminUrl: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="dash-state">
      <span className="dash-state-icon" aria-hidden="true">
        <Icon name="shield" size={20} />
      </span>
      <p className="dash-state-title">
        {configured ? "Pi-hole is unreachable" : "Connect your Pi-hole"}
      </p>
      <p className="dash-state-copy">
        {configured
          ? error
          : "Add your Pi-hole URL and an app password to see live DNS stats here."}
      </p>
      <div className="dash-state-actions">
        <button className="dash-button" type="button" onClick={onRetry}>
          Try again
        </button>
        {adminUrl ? (
          <a
            className="dash-button dash-button-quiet"
            href={adminUrl}
            target="_blank"
            rel="noreferrer"
          >
            Open admin
          </a>
        ) : null}
      </div>
      {!configured ? (
        <details className="dash-setup">
          <summary>How to connect</summary>
          <ol>
            <li>In Pi-hole, open Settings → API and create an app password.</li>
            <li>
              Add <code>PIHOLE_URL</code> and <code>PIHOLE_PASSWORD</code> (v6) or{" "}
              <code>PIHOLE_API_TOKEN</code> (v5) to <code>.dev.vars</code>.
            </li>
            <li>
              Restart <code>npm run dev</code> and reload this page.
            </li>
          </ol>
        </details>
      ) : null}
    </div>
  );
}

export default function Dashboard({ initialNow }: { initialNow: string }) {
  const [now, setNow] = useState(() => new Date(initialNow));
  const [query, setQuery] = useState("");
  const [pihole, setPihole] = useState<PiholeState | null>(null);
  const [piholeLoading, setPiholeLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const theme = useSyncExternalStore(
    subscribeTheme,
    themeSnapshot,
    serverThemeSnapshot,
  );

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    // The first paint can be a static build; refresh it shortly after hydration.
    const refresh = window.setTimeout(() => setNow(new Date()), 1_000);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(refresh);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function load(silent: boolean) {
      if (!silent) setPiholeLoading(true);
      try {
        const response = await fetch("/api/pihole", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as PiholeState;
        if (active) {
          setPihole(data);
          setPiholeLoading(false);
        }
      } catch {
        if (active) {
          setPihole({
            configured: true,
            online: false,
            error:
              "The dashboard could not reach its Pi-hole endpoint. Check the server logs and try again.",
            adminUrl: null,
          });
          setPiholeLoading(false);
        }
      }
    }

    void load(false);
    const timer = window.setInterval(() => {
      if (!document.hidden) void load(true);
    }, 60_000);
    const onVisibility = () => {
      if (!document.hidden) void load(true);
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [retryToken]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (
        event.key === "Escape" &&
        document.activeElement === searchRef.current
      ) {
        setQuery("");
        searchRef.current?.blur();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredDestinations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return destinations;
    return destinations.filter((destination) =>
      [
        destination.name,
        destination.description,
        destination.meta,
        destination.group,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  const filteredNotes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;
    return notes.filter((note) =>
      [note.title, note.excerpt, note.category, note.date]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      window.localStorage.setItem("kc-theme", next);
    } catch {
      // Storage can be blocked in private mode; the theme still applies for this visit.
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const hour = Number(hourFormatter.format(now));
  const greeting = greetingFor(hour);
  const isConfigured = pihole !== null && pihole.configured;
  const isOnline = isConfigured && pihole.online;
  const isLoading = piholeLoading;

  const tone: Tone = isLoading
    ? "wait"
    : !isConfigured
      ? "idle"
      : isOnline
        ? "ok"
        : "error";

  const statusLabel = isLoading
    ? "Checking Pi-hole…"
    : !isConfigured
      ? "Pi-hole is not connected"
      : isOnline
        ? `Pi-hole online · ${formatPercent(
            (pihole as PiholeOnline).percentBlocked,
          )} blocked`
        : "Pi-hole unreachable";

  const blockedValue = isLoading
    ? "—"
    : isOnline
      ? formatPercent((pihole as PiholeOnline).percentBlocked)
      : "—";

  const noteWord = notes.length === 1 ? "note" : "notes";

  return (
    <div className="dashboard">
      <a className="dash-skip" href="#dash-main">
        Skip to content
      </a>

      <div className="dash-shell">
        <header className="dash-topbar">
          <a className="dash-brand" href="/" aria-label="KC dashboard home">
            KC<span>°</span>
          </a>

          <nav className="dash-nav" aria-label="Dashboard sections">
            <a href="#destinations">Apps</a>
            <a href="/archive">Archive</a>
            <a href="#status">Status</a>
          </nav>

          <div className="dash-search">
            <Icon name="search" size={16} />
            <label className="sr-only" htmlFor="dash-search">
              Search apps and notes
            </label>
            <input
              id="dash-search"
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search apps & notes"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd aria-hidden="true">⌘K</kbd>
          </div>

          <div className="dash-top-actions">
            <span className="dash-clock">
              {timeFormatter.format(now)}
              <span className="dash-clock-label"> · {owner.timeZone.split("/")[1]?.replace("_", " ")}</span>
            </span>
            <button
              className="dash-icon-button"
              type="button"
              onClick={toggleTheme}
              aria-pressed={theme === "dark"}
              aria-label={
                theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
              }
              title="Toggle dark mode"
            >
              <span className="dash-theme-icon dash-theme-icon-moon">
                <Icon name="moon" size={17} />
              </span>
              <span className="dash-theme-icon dash-theme-icon-sun">
                <Icon name="sun" size={17} />
              </span>
            </button>
          </div>
        </header>

        <main id="dash-main" tabIndex={-1}>
          <p className="sr-only" role="status" aria-live="polite">
            {query
              ? `${filteredDestinations.length} destinations and ${filteredNotes.length} notes match “${query}”.`
              : ""}
          </p>

          <section className="dash-hero" aria-labelledby="dash-greeting">
            <div>
              <p className="dash-eyebrow">
                <span
                  className={`dash-dot dash-dot-${tone}`}
                  aria-hidden="true"
                />
                Personal command center · {statusLabel}
              </p>
              <h1 id="dash-greeting">
                {greeting},<br />
                <em>{owner.name}.</em>
              </h1>
              <p className="dash-lede">
                Every app, archive and system you keep — one door away.
              </p>
            </div>
            <div className="dash-hero-meta">
              <p className="dash-date">{formatLongDate(now)}</p>
              <p className="dash-place">
                {owner.location} · {timeFormatter.format(now)}
              </p>
              <p className="dash-coords">38.7223° N · 09.1393° W</p>
            </div>
          </section>

          <section className="dash-stats" aria-label="Archive at a glance">
            <a className="dash-stat" href="/archive#watches">
              <span className="dash-stat-label">Owned</span>
              <strong>{pad(owned.length)}</strong>
              <small>pieces in the collection</small>
              <Icon
                className="dash-stat-arrow"
                name="arrow-up-right"
                size={14}
              />
            </a>
            <a className="dash-stat" href="/archive#watches">
              <span className="dash-stat-label">Wishlist</span>
              <strong>{pad(wishlist.length)}</strong>
              <small>considering next</small>
              <Icon
                className="dash-stat-arrow"
                name="arrow-up-right"
                size={14}
              />
            </a>
            <a className="dash-stat" href="/archive#notes">
              <span className="dash-stat-label">Notes</span>
              <strong>{pad(notes.length)}</strong>
              <small>published from Obsidian</small>
              <Icon
                className="dash-stat-arrow"
                name="arrow-up-right"
                size={14}
              />
            </a>
            <a className="dash-stat" href="#pihole">
              <span className="dash-stat-label">Blocked</span>
              <strong>{blockedValue}</strong>
              <small>
                {isLoading
                  ? "checking Pi-hole…"
                  : isOnline
                    ? "DNS queries today"
                    : isConfigured
                      ? "Pi-hole unreachable"
                      : "Pi-hole not connected"}
              </small>
              <Icon
                className="dash-stat-arrow"
                name="arrow-up-right"
                size={14}
              />
            </a>
          </section>

          <div className="dash-grid">
            <section
              className="dash-card dash-destinations"
              id="destinations"
              aria-labelledby="dash-destinations-title"
            >
              <div className="dash-card-head">
                <span className="dash-kicker">01 · Destinations</span>
                <span className="dash-count">
                  {filteredDestinations.length}/{destinations.length}
                </span>
              </div>
              <h2 id="dash-destinations-title">Every app, one list.</h2>

              {filteredDestinations.length === 0 ? (
                <p className="dash-empty">No destinations match “{query}”.</p>
              ) : (
                <ul className="dash-dest-list">
                  {filteredDestinations.map((destination) => {
                    const external =
                      destination.external || !destination.href.startsWith("/");
                    return (
                      <li key={destination.id}>
                        {external ? (
                          <a
                            href={destination.href}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="dash-dest-icon" aria-hidden="true">
                              <Icon name={destination.icon} size={16} />
                            </span>
                            <span className="dash-dest-text">
                              <b>{destination.name}</b>
                              <small>
                                {destination.group} · {destination.meta}
                              </small>
                            </span>
                            <Icon name="external" size={14} />
                          </a>
                        ) : (
                          <a href={destination.href}>
                            <span className="dash-dest-icon" aria-hidden="true">
                              <Icon name={destination.icon} size={16} />
                            </span>
                            <span className="dash-dest-text">
                              <b>{destination.name}</b>
                              <small>
                                {destination.group} · {destination.meta}
                              </small>
                            </span>
                            <Icon
                              name={
                                destination.href.startsWith("#")
                                  ? "arrow-right"
                                  : "arrow-up-right"
                              }
                              size={14}
                            />
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              <p className="dash-dest-hint">
                Add a service in <code>app/dashboard-config.ts</code>.
              </p>
            </section>

            <section className="dash-card dash-watch" aria-labelledby="dash-watch-title">
              <h2 className="sr-only" id="dash-watch-title">
                Watch archive
              </h2>
              <div className="dash-card-head">
                <span className="dash-kicker">02 · Watch archive</span>
                <a className="dash-text-link" href="/archive#watches">
                  Open archive <Icon name="arrow-right" size={14} />
                </a>
              </div>

              <div className="dash-watch-body">
                <div>
                  <p className="dash-watch-count">
                    <strong>{pad(watches.length)}</strong>
                    <span>pieces</span>
                  </p>
                  <p className="dash-watch-split">
                    {pad(owned.length)} owned · {pad(wishlist.length)} wished ·{" "}
                    {pad(grail.length)} grail
                  </p>
                </div>
                <div className="dash-dials">
                  {owned.slice(0, 3).map((watch) => (
                    <span
                      className="dash-dial"
                      key={watch.name}
                      style={{
                        background: watch.dial,
                        borderColor: watch.accent,
                      }}
                      aria-hidden="true"
                    >
                      <i />
                    </span>
                  ))}
                </div>
              </div>

              <div className="dash-watch-foot">
                <span>Grail</span>
                <p>{grail[0]?.name ?? "Still deciding"}</p>
                <a
                  href="/archive#watches"
                  aria-label="See the grail watch in the archive"
                >
                  <Icon name="arrow-up-right" size={16} />
                </a>
              </div>
            </section>

            <section
              className="dash-card dash-pihole"
              id="pihole"
              aria-labelledby="dash-pihole-title"
            >
              <div className="dash-card-head">
                <span className="dash-kicker">03 · Homelab</span>
                <span className={`dash-pill dash-pill-${tone}`}>
                  {isLoading
                    ? "Checking"
                    : !isConfigured
                      ? "Setup"
                      : isOnline
                        ? "Live"
                        : "Offline"}
                </span>
              </div>
              <div className="dash-pihole-head">
                <h2 id="dash-pihole-title">Pi-hole</h2>
                <p>Network-wide DNS filtering.</p>
              </div>

              {piholeLoading ? (
                <PiholeSkeleton />
              ) : !pihole || !pihole.configured ? (
                <PiholeUnavailable
                  configured={false}
                  adminUrl={null}
                  onRetry={() => setRetryToken((token) => token + 1)}
                />
              ) : pihole.online ? (
                <PiholeLive
                  data={pihole}
                  onRefresh={() => setRetryToken((token) => token + 1)}
                />
              ) : (
                <PiholeUnavailable
                  configured
                  error={(pihole as PiholeOffline).error}
                  adminUrl={pihole.adminUrl}
                  onRetry={() => setRetryToken((token) => token + 1)}
                />
              )}
            </section>

            <section className="dash-card dash-notes" aria-labelledby="dash-notes-title">
              <div className="dash-card-head">
                <span className="dash-kicker">04 · Notes archive</span>
                <a className="dash-text-link" href="/archive#notes">
                  All notes <Icon name="arrow-right" size={14} />
                </a>
              </div>
              <div className="dash-notes-head">
                <h2 id="dash-notes-title">
                  From the notebook<span>.</span>
                </h2>
                <p>
                  {pad(notes.length)} published {noteWord}
                </p>
              </div>

              <div className="dash-note-list">
                {filteredNotes.length === 0 ? (
                  <p className="dash-empty">
                    No notes match “{query}”.
                  </p>
                ) : (
                  filteredNotes.slice(0, 3).map((note) => (
                    <article className="dash-note" key={note.slug || note.title}>
                      <span className="dash-note-cat">{note.category}</span>
                      <h3>{note.title}</h3>
                      <p>{note.excerpt}</p>
                      <div className="dash-note-meta">
                        <span>{note.date}</span>
                        <span>{note.read} read</span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

          </div>

          <footer className="dash-footer" id="status">
            <p>
              <span
                className={`dash-dot dash-dot-${tone}`}
                aria-hidden="true"
              />
              {statusLabel}
            </p>
            <p>
              {watches.length} watches · {notes.length} {noteWord}
            </p>
            <p>
              <a href="/archive">Open archive</a>
              <span aria-hidden="true">·</span>
              <a href="#dash-main">Back to top ↑</a>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}
