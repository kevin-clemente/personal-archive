/**
 * Edit this file to add apps, archives or homelab services to the dashboard.
 * Every destination needs a unique `id` and an `href`:
 *   - internal pages start with "/" (for example "/archive#watches")
 *   - anything else opens in a new tab (for example "http://pihole.local/admin")
 */
export type DestinationIcon = "watch" | "note" | "shield" | "vault" | "link";

export type DestinationGroup = "Archives" | "Homelab" | "Tools";

export type Destination = {
  id: string;
  name: string;
  description: string;
  href: string;
  meta: string;
  icon: DestinationIcon;
  group: DestinationGroup;
  external?: boolean;
};

export const owner = {
  name: "Kevin",
  location: "Lisbon, Portugal",
  timeZone: "Europe/Lisbon",
} as const;

export const destinations: Destination[] = [
  {
    id: "watches",
    name: "Watch archive",
    description: "Collection, wishlist and the grail list.",
    href: "/archive#watches",
    meta: "Collection · Wishlist · Grail",
    icon: "watch",
    group: "Archives",
  },
  {
    id: "notes",
    name: "Notes archive",
    description: "Everything published from the Obsidian vault.",
    href: "/archive#notes",
    meta: "Published from Obsidian",
    icon: "note",
    group: "Archives",
  },
  {
    id: "pihole",
    name: "Pi-hole",
    description: "Network-wide DNS filtering and query stats.",
    href: "#pihole",
    meta: "DNS · Blocking",
    icon: "shield",
    group: "Homelab",
  },
  {
    id: "obsidian",
    name: "Obsidian vault",
    description: "Open the Kvan vault on this Mac.",
    href: "obsidian://open?vault=Kvan",
    meta: "Open the source vault",
    icon: "vault",
    group: "Tools",
    external: true,
  },
  // Add your own, for example:
  // {
  //   id: "home-assistant",
  //   name: "Home Assistant",
  //   description: "Lights, climate and sensors.",
  //   href: "http://homeassistant.local:8123",
  //   meta: "Home automation",
  //   icon: "link",
  //   group: "Homelab",
  //   external: true,
  // },
];
