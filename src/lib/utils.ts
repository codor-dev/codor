import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Matches dotted-quad IPv4 addresses where every octet is 0-255.
const IPV4_RE =
  /\b((?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d))\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\.(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;

/**
 * Mask the last two octets of any IPv4 address in `text` for display, keeping
 * the first two (e.g. `203.0.113.45` → `203.0.•.•`). Display-only — the stored
 * message and the executed command keep the real address.
 */
export function maskIPs(text: string): string {
  if (!text) return text;
  return text.replace(IPV4_RE, "$1.•.•");
}
