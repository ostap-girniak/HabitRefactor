import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HabitRefactor — you vs you",
    short_name: "Refactor",
    description:
      "Identity-based habit refactoring portal. Track habits, journal with AI, and forge a new identity. Stay hard.",
    start_url: "/dashboard",
    id: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#0A0A0F",
    theme_color: "#0A0A0F",
    orientation: "portrait-primary",
    categories: ["health", "lifestyle", "productivity"],
    lang: "uk",
    dir: "ltr",
    icons: [
      {
        src: "/icons/favicon-32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        form_factor: "narrow",
        label: "HabitRefactor Dashboard",
      },
    ],
    shortcuts: [
      {
        name: "Check In",
        short_name: "Check-in",
        url: "/checkin",
        description: "Daily habit check-in",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Journal",
        short_name: "Journal",
        url: "/journal",
        description: "Voice & text journal",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "AI Insights",
        short_name: "Insights",
        url: "/insights",
        description: "AI-powered analysis",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
