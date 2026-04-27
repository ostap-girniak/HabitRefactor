"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

export function PwaInstallPrompt() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Check if already installed
    window.addEventListener("appinstalled", () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
    } else {
      console.log("User dismissed the install prompt");
    }

    // Clear the deferred prompt variable, it can only be used once.
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  if (!isInstallable || isDismissed) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-80 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-xl p-4 shadow-xl z-50 animate-slide-up flex items-start gap-3">
      <div className="bg-[var(--accent-fire-subtle)] p-2 rounded-lg text-[var(--accent-fire)] shrink-0">
        <Download className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Install HabitRefactor</h3>
        <p className="text-xs text-[var(--text-secondary)] mt-1">Get the full native experience with offline access.</p>
        <button
          onClick={handleInstallClick}
          className="mt-3 w-full bg-[var(--accent-fire)] text-white text-xs font-bold py-2 rounded-lg hover:bg-orange-600 transition-colors"
        >
          Install App
        </button>
      </div>
      <button 
        onClick={() => setIsDismissed(true)}
        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 p-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
