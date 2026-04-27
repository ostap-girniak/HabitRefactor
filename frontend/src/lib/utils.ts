import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format seconds into "Xd Xh Xm Xs" display
 */
export function formatDuration(totalSeconds: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  display: string;
} {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return {
    days,
    hours,
    minutes,
    seconds,
    display: `${days}d ${hours}h ${minutes}m ${seconds}s`,
  };
}

/**
 * Format a number as UAH currency
 */
export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get a motivational message based on streak length
 */
export function getStreakMessage(days: number): string {
  if (days === 0) return "Day zero. The forge ignites NOW. 🔥";
  if (days === 1) return "First day conquered. Stay hard. 💪";
  if (days < 7) return "Building momentum. Don't stop. ⚡";
  if (days < 14) return "One week strong. You're forging steel. 🗡️";
  if (days < 30) return "Two weeks. Your old self is dying. The new you rises. 🔥";
  if (days < 60) return "A month of dominance. This is who you ARE now. 👑";
  if (days < 90) return "60+ days. The neural pathways are rewiring. Science is on your side. 🧠";
  if (days < 180) return "90+ days. You've crossed the threshold. You are FORGED. ⚔️";
  if (days < 365) return "Half a year. You are a different person now. Literally. 🏆";
  return `${days} days. LEGENDARY. You are the proof that humans can transform. 👑🔥`;
}

/**
 * Get emoji for habit category
 */
export function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    smoking: "🚬",
    alcohol: "🍺",
    food: "🍔",
    social_media: "📱",
    porn: "🔞",
    swearing: "🤬",
    gambling: "🎰",
    drugs: "💊",
    procrastination: "⏰",
    other: "🎯",
  };
  return map[category] || "🎯";
}

/**
 * Get color for checkin result
 */
export function getResultColor(result: string): string {
  switch (result) {
    case "success":
      return "text-green-400";
    case "relapse":
      return "text-red-400";
    case "partial":
      return "text-yellow-400";
    default:
      return "text-gray-400";
  }
}
