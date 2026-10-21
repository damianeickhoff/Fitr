import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FITR",
    short_name: "FITR",
    description: "Your wardrobe as a shop, with outfits and styling advice.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f2e9",
    theme_color: "#f7f2e9",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
