import type { Metadata } from "next";
import Dashboard from "./dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "A private command center for the watch archive, published notes and the homelab.",
};

export default function HomePage() {
  return <Dashboard initialNow={new Date().toISOString()} />;
}
