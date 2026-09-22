import { registerSW } from "virtual:pwa-register";

/**
 * Keep the installed app on the latest deploy.
 * Checks for a new service worker on boot, every 15 minutes, and whenever the
 * app comes back to the foreground — then applies it and reloads in place.
 */
export function initPwa(): void {
  const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, reg) {
      if (!reg) return;
      const check = () => {
        void reg.update().catch(() => {});
      };
      window.setInterval(check, 15 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
    onNeedRefresh() {
      void updateSW(true); // skipWaiting + reload into the new version
    }
  });
}
