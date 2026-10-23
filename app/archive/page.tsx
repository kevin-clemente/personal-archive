import type { Metadata } from "next";
import ArchiveView from "./archive-view";

export const metadata: Metadata = {
  title: "Watches & Notes",
  description:
    "Watches collected, pieces still dreamt of, and notes gathered along the way.",
};

export default function ArchivePage() {
  return <ArchiveView />;
}
