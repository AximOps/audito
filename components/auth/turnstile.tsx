"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { turnstileSiteKey } from "@/lib/auth-config";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    __auditopsTurnstileLoading?: Promise<void>;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (window.__auditopsTurnstileLoading) return window.__auditopsTurnstileLoading;

  window.__auditopsTurnstileLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      window.__auditopsTurnstileLoading = undefined;
      reject(new Error("Unable to load Cloudflare Turnstile."));
    };
    document.head.appendChild(script);
  });
  return window.__auditopsTurnstileLoading;
}

export type TurnstileHandle = { reset: () => void };

export const turnstileRequired = Boolean(turnstileSiteKey);

/**
 * Cloudflare Turnstile widget. Renders nothing when
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset (local development).
 * Tokens are single-use: call ref.reset() after every submit attempt.
 */
export const Turnstile = forwardRef<
  TurnstileHandle,
  { action: string; onToken: (token: string | null) => void; onError?: (message: string) => void }
>(function Turnstile({ action, onToken, onError }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const tokenCb = useRef(onToken);
  const errorCb = useRef(onError);
  tokenCb.current = onToken;
  errorCb.current = onError;

  useImperativeHandle(ref, () => ({
    reset() {
      tokenCb.current(null);
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!turnstileSiteKey) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile || widgetId.current) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: turnstileSiteKey,
          action,
          theme: "light",
          size: "flexible",
          "refresh-expired": "auto",
          callback: (token: string) => tokenCb.current(token),
          "expired-callback": () => tokenCb.current(null),
          "error-callback": () => {
            tokenCb.current(null);
            errorCb.current?.("Security check could not load. Refresh the page and try again.");
          },
        });
      })
      .catch((error: Error) => errorCb.current?.(error.message));

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [action]);

  if (!turnstileSiteKey) return null;
  return <div ref={container} className="min-h-[65px]" />;
});
