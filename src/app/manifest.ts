import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/settings";

// Makes the site installable as an app (Android, Windows, ChromeOS, macOS; iPhone/iPad via
// "Sur l'écran d'accueil"). Served at /manifest.webmanifest.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { siteName } = await getSiteSettings();
  return {
    id: "/",
    name: siteName,
    short_name: siteName.length > 12 ? "Rendezvous" : siteName,
    description: "Soirées de jeux, ludothèque, parties jouées.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#1b1410",
    theme_color: "#1b1410",
    lang: "fr-CA",
    categories: ["games", "social", "lifestyle"],
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Parties", url: "/events", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
      { name: "Ma Kallax", url: "/kallax", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
      { name: "Noter une partie", url: "/plays/new", icons: [{ src: "/app-icon/192", sizes: "192x192" }] },
    ],
  };
}
