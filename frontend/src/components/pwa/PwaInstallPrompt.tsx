"use client";

import { useState, useEffect } from "react";
import { Download, X, Share } from "lucide-react";

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    ("standalone" in navigator && (navigator as any).standalone === true) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function PwaInstallPrompt() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Already installed as PWA — don't show
    if (isInStandaloneMode()) return;

    // Check if user dismissed before (once per session)
    const dismissed = sessionStorage.getItem("pwa-install-dismissed");
    if (dismissed) return;

    // Android / Chrome: listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowAndroidPrompt(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // iOS Safari: no beforeinstallprompt, show manual instructions
    if (isIos() && !isInStandaloneMode()) {
      // Delay showing on iOS so it's not annoying on first load
      const timer = setTimeout(() => setShowIosPrompt(true), 3000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }

    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setShowAndroidPrompt(false);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  };

  const handleAndroidInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    }
    setDeferredPrompt(null);
    setShowAndroidPrompt(false);
  };

  if (isDismissed) return null;

  // Android / Chrome prompt
  if (showAndroidPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-80 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-4 shadow-xl z-50 animate-slide-up flex items-start gap-3">
        <div className="bg-[var(--accent-fire-subtle)] p-2 rounded-lg text-[var(--accent-fire)] shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Install HabitRefactor</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Get the full native experience with offline access.</p>
          <button
            onClick={handleAndroidInstall}
            className="mt-3 w-full bg-[var(--accent-fire)] text-white text-xs font-bold py-2 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Install App
          </button>
        </div>
        <button
          onClick={handleDismiss}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // iOS Safari prompt (manual instructions)
  if (showIosPrompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-80 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-4 shadow-xl z-50 animate-slide-up flex items-start gap-3">
        <div className="bg-[var(--accent-fire-subtle)] p-2 rounded-lg text-[var(--accent-fire)] shrink-0">
          <Download className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Install HabitRefactor</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Tap{" "}
            <Share className="w-3.5 h-3.5 inline-block text-[var(--accent-info)] -mt-0.5" />{" "}
            <span className="font-semibold text-[var(--accent-info)]">Share</span> in Safari, then{" "}
            <span className="font-semibold text-[var(--text-primary)]">&quot;Add to Home Screen&quot;</span>
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
            <span className="bg-[var(--bg-hover)] px-2 py-1 rounded">1. Tap Share ↗</span>
            <span>→</span>
            <span className="bg-[var(--bg-hover)] px-2 py-1 rounded">2. Add to Home Screen</span>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return null;
}
