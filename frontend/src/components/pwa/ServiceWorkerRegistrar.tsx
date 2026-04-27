"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Avoid registering during SSR/hydration mismatch; this runs only on client.
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("[PWA] SW register failed:", err));
  }, []);

  return null;
}

