import { Platform } from "react-native";

/** Situação de instalação do PWA (só faz sentido na web). */
export type InstallState = "standalone" | "ios-safari" | "ios-other" | "promptable" | "other";

let deferredPrompt: any = null;
const listeners = new Set<() => void>();

if (Platform.OS === "web" && typeof window !== "undefined") {
  // Android/Chrome/Edge: o navegador oferece um prompt de instalação próprio.
  window.addEventListener("beforeinstallprompt", (e: any) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((l) => l());
  });
}

export function onInstallAvailable(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function installState(): InstallState {
  if (Platform.OS !== "web" || typeof navigator === "undefined" || typeof window === "undefined") return "other";
  const standalone = (navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;
  if (standalone) return "standalone";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && (navigator.maxTouchPoints ?? 0) > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-other" : "ios-safari";
  return deferredPrompt ? "promptable" : "other";
}

export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => null);
  deferredPrompt = null;
  return choice?.outcome === "accepted";
}

const DISMISS_KEY = "fluent.installHint.dismissed";
export function installHintDismissed(): boolean {
  try { return typeof localStorage !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}
export function dismissInstallHint() {
  try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* armazenamento indisponível */ }
}
