import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FITR",
    short_name: "FITR",
    description: "Your wardrobe as a shop, with outfits and styling advice.",
    start_url: "/",
    display: "standalone",
    background_color: "#eceef1",
    theme_color: "#eceef1",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
