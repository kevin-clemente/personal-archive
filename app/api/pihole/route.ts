import type { PiholeState } from "../../pihole-types";

export const dynamic = "force-dynamic";

type PiholeBindings = {
  PIHOLE_URL?: string;
  PIHOLE_ADMIN_URL?: string;
  PIHOLE_PASSWORD?: string;
  PIHOLE_API_TOKEN?: string;
  PIHOLE_VERSION?: string;
};

type PiholeMetrics = {
  status: string;
  queries: number;
  blocked: number;
  percentBlocked: number;
  gravityDomains: number | null;
};

type PiholeErrorCode = "auth" | "http" | "network" | "timeout";

class PiholeError extends Error {
  readonly code: PiholeErrorCode;
  readonly status?: number;

  constructor(code: PiholeErrorCode, status?: number) {
    super(code);
    this.name = "PiholeError";
    this.code = code;
    this.status = status;
  }
}

class SessionCache {
  private entry: { baseUrl: string; sid: string; expiresAt: number } | null = null;

  get(baseUrl: string): string | null {
    if (!this.entry) return null;
    if (this.entry.baseUrl !== baseUrl) return null;
    if (this.entry.expiresAt <= Date.now()) return null;
    return this.entry.sid;
  }

  set(baseUrl: string, sid: string, validitySeconds: number): void {
    const lifetime = Math.max(60, validitySeconds - 30);
    this.entry = { baseUrl, sid, expiresAt: Date.now() + lifetime * 1000 };
  }

  clear(): void {
    this.entry = null;
  }
}

const session = new SessionCache();

function setting(key: keyof PiholeBindings): string | undefined {
  // `process.env` works under `vinext start` (Node) and in Workers because
  // vite.config.ts enables `nodejs_compat_populate_process_env`.
  const value = process.env[key];
  return value?.trim() || undefined;
}

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function asNumber(value: unknown): number | null {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(number) ? number : null;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value * 10) / 10));
}

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new PiholeError("timeout");
    }
    throw new PiholeError("network");
  }
}

function ensureOk(response: Response): void {
  if (response.status === 401 || response.status === 403) {
    throw new PiholeError("auth");
  }
  if (!response.ok) {
    throw new PiholeError("http", response.status);
  }
}

type V6Session = {
  session?: {
    sid?: unknown;
    validity?: unknown;
  };
};

type V6Summary = {
  status?: unknown;
  queries?: {
    total?: unknown;
    blocked?: unknown;
    percent_blocked?: unknown;
  };
  gravity?: {
    domains_being_blocked?: unknown;
  };
};

async function v6Sid(baseUrl: string, password: string): Promise<string> {
  const cached = session.get(baseUrl);
  if (cached) return cached;

  const response = await request(`${baseUrl}/api/auth`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  if (response.status === 401 || response.status === 403) {
    throw new PiholeError("auth");
  }
  if (!response.ok) {
    throw new PiholeError("http", response.status);
  }

  const data = (await response.json()) as V6Session;
  const sid = typeof data.session?.sid === "string" ? data.session.sid : "";
  if (!sid) throw new PiholeError("auth");

  const validity =
    typeof data.session?.validity === "number" && data.session.validity > 0
      ? data.session.validity
      : 300;
  session.set(baseUrl, sid, validity);
  return sid;
}

function v6Summary(baseUrl: string, sid: string): Promise<Response> {
  return request(`${baseUrl}/api/stats/summary`, {
    headers: {
      accept: "application/json",
      "X-FTL-SID": sid,
    },
  });
}

async function readV6(baseUrl: string, password: string): Promise<PiholeMetrics> {
  let sid = await v6Sid(baseUrl, password);
  let response = await v6Summary(baseUrl, sid);

  // A cached session can expire between polls. Re-authenticate once, then give up.
  if (response.status === 401) {
    session.clear();
    sid = await v6Sid(baseUrl, password);
    response = await v6Summary(baseUrl, sid);
  }
  ensureOk(response);

  const data = (await response.json()) as V6Summary;
  const queries = asNumber(data.queries?.total) ?? 0;
  const blocked = asNumber(data.queries?.blocked) ?? 0;
  const reported = asNumber(data.queries?.percent_blocked);
  const percent =
    reported ?? (queries > 0 ? (blocked / queries) * 100 : 0);

  return {
    status: typeof data.status === "string" ? data.status : "enabled",
    queries,
    blocked,
    percentBlocked: clampPercent(percent),
    gravityDomains: asNumber(data.gravity?.domains_being_blocked),
  };
}

type V5Summary = {
  status?: unknown;
  domains_being_blocked?: unknown;
  dns_queries_today?: unknown;
  ads_blocked_today?: unknown;
  ads_percentage_today?: unknown;
  error?: unknown;
};

async function readV5(baseUrl: string, token: string): Promise<PiholeMetrics> {
  const response = await request(
    `${baseUrl}/admin/api.php?summaryRaw&auth=${encodeURIComponent(token)}`,
    { headers: { accept: "application/json" } },
  );
  ensureOk(response);

  const data = (await response.json()) as V5Summary;
  if (data.error) throw new PiholeError("auth");

  const queries = asNumber(data.dns_queries_today) ?? 0;
  const blocked = asNumber(data.ads_blocked_today) ?? 0;
  const reported = asNumber(data.ads_percentage_today);
  const percent =
    reported ?? (queries > 0 ? (blocked / queries) * 100 : 0);

  return {
    status: typeof data.status === "string" ? data.status : "enabled",
    queries,
    blocked,
    percentBlocked: clampPercent(percent),
    gravityDomains: asNumber(data.domains_being_blocked),
  };
}

function describeError(error: unknown): string {
  if (!(error instanceof PiholeError)) {
    return "Unexpected error while reading Pi-hole.";
  }

  switch (error.code) {
    case "auth":
      return "Pi-hole rejected the credentials. Check PIHOLE_PASSWORD or PIHOLE_API_TOKEN.";
    case "timeout":
      return "Pi-hole did not respond within 6 seconds.";
    case "network":
      return "Could not reach Pi-hole. Check PIHOLE_URL and that the machine running this dashboard can see it on the network.";
    case "http":
      return `Pi-hole returned HTTP ${error.status ?? "error"}.`;
  }
}

function json(body: PiholeState): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET(): Promise<Response> {
  const rawUrl = setting("PIHOLE_URL");
  if (!rawUrl) return json({ configured: false });

  const baseUrl = normalizeUrl(rawUrl);
  const adminUrl = normalizeUrl(setting("PIHOLE_ADMIN_URL") ?? `${baseUrl}/admin`);

  const password = setting("PIHOLE_PASSWORD");
  const token = setting("PIHOLE_API_TOKEN");
  const forcedVersion = setting("PIHOLE_VERSION");

  const version =
    forcedVersion === "v5" || forcedVersion === "v6"
      ? forcedVersion
      : password
        ? "v6"
        : token
          ? "v5"
          : null;

  if (
    !version ||
    (version === "v6" && !password) ||
    (version === "v5" && !token)
  ) {
    return json({
      configured: true,
      online: false,
      adminUrl,
      error:
        "Add Pi-hole credentials: PIHOLE_PASSWORD for Pi-hole v6, or PIHOLE_API_TOKEN for v5.",
    });
  }

  try {
    const metrics =
      version === "v6"
        ? await readV6(baseUrl, password as string)
        : await readV5(baseUrl, token as string);

    return json({
      configured: true,
      online: true,
      version,
      adminUrl,
      fetchedAt: new Date().toISOString(),
      ...metrics,
    });
  } catch (error) {
    return json({
      configured: true,
      online: false,
      adminUrl,
      error: describeError(error),
    });
  }
}
