import type { MetadataRoute } from "next";

/**
 * The home-screen app. One manifest serves every profile, so it is in English
 * and uses the default accent; the open profile's colour takes over once the
 * app is running. Icons come from `npm run icons`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FITR",
    short_name: "FITR",
    description: "Your wardrobe as a shop, with outfits and styling advice.",
    lang: "en-GB",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f2e9",
    theme_color: "#f7f2e9",
    categories: ["lifestyle", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Add pieces",
        url: "/add",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Outfits",
        url: "/outfits",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
