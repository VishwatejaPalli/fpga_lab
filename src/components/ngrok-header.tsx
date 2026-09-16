"use client";

import { useEffect } from "react";

/**
 * Patches the global `fetch` to include the `ngrok-skip-browser-warning`
 * request header on every call. This prevents the ngrok interstitial
 * warning page from intercepting API/fetch responses when the app
 * is served through an ngrok tunnel.
 *
 * Mount this component once in the root layout.
 */
export function NgrokHeader() {
  useEffect(() => {
    const originalFetch = window.fetch;

    window.fetch = function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit,
    ) {
      const headers = new Headers(init?.headers);
      if (!headers.has("ngrok-skip-browser-warning")) {
        headers.set("ngrok-skip-browser-warning", "1");
      }
      return originalFetch(input, { ...init, headers });
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
