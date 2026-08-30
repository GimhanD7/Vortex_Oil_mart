export async function clearAuthSession(options: { server?: boolean } = {}) {
  const shouldCallServer = options.server ?? true;

  if (shouldCallServer && typeof window !== "undefined") {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
      });
    } catch {
      // Local cleanup still protects the UI when the API is unavailable.
    }
  }

  if (typeof document !== "undefined") {
    document.cookie = "auth_token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax";
    document.cookie = "auth_token=; Max-Age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  }

  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.clear();
  } catch {
    // Ignore unavailable storage in restricted browser modes.
  }

  try {
    const removePrefixes = ["cache:", "oil-mart-cash-cycle-"];
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key === "oil-mart-auth-token" || (key && removePrefixes.some((prefix) => key.startsWith(prefix)))) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore unavailable storage in restricted browser modes.
  }

  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.controller?.postMessage({ type: "CLEAR_OIL_MART_CACHE" });
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ type: "CLEAR_OIL_MART_CACHE" });
    }
  } catch {
    // Service worker cache clearing is best-effort.
  }

  try {
    if ("caches" in window) {
      const names = await window.caches.keys();
      await Promise.all(names.map((name) => window.caches.delete(name)));
    }
  } catch {
    // Cache API may be unavailable in private or restricted modes.
  }
}

export async function logoutToLogin() {
  await clearAuthSession();
  if (typeof window !== "undefined") {
    window.location.replace("/");
  }
}
