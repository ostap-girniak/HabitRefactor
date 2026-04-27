import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HabitRefactor — you vs you",
    short_name: "Refactor",
    description:
      "Identity-based habit refactoring portal. Stay hard.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0A0A0F",
    theme_color: "#FF4D00",
    orientation: "portrait-primary",
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
