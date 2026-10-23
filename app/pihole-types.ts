/** Shared contract between the Pi-hole API route and the dashboard UI. */

export type PiholeOnline = {
  configured: true;
  online: true;
  version: "v5" | "v6";
  status: string;
  queries: number;
  blocked: number;
  percentBlocked: number;
  gravityDomains: number | null;
  adminUrl: string | null;
  fetchedAt: string;
};

export type PiholeOffline = {
  configured: true;
  online: false;
  error: string;
  adminUrl: string | null;
};

export type PiholeNotConfigured = {
  configured: false;
};

export type PiholeState = PiholeOnline | PiholeOffline | PiholeNotConfigured;
