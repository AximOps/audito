"use client";

import { useState } from "react";
import { Building2, Globe, Loader2 } from "lucide-react";
import { authMethods, type OAuthProvider } from "@/lib/auth-config";

/**
 * "Continue with Google / Microsoft". Uses neutral icons; swap in the
 * official provider marks per Google / Microsoft branding guidelines if
 * desired (public/ assets).
 */
export default function OAuthButtons({
  captchaToken,
  captchaRequired,
  next,
  onError,
  onAttempt,
}: {
  captchaToken: string | null;
  captchaRequired: boolean;
  next?: string | null;
  onError: (message: string) => void;
  onAttempt: () => void;
}) {
  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const providers: { id: OAuthProvider; label: string; icon: typeof Globe }[] = [];
  if (authMethods.google) providers.push({ id: "google", label: "Continue with Google", icon: Globe });
  if (authMethods.azure) providers.push({ id: "azure", label: "Continue with Microsoft", icon: Building2 });
  if (providers.length === 0) return null;

  async function start(provider: OAuthProvider) {
    if (captchaRequired && !captchaToken) {
      onError("Please complete the security check first.");
      return;
    }
    setBusy(provider);
    try {
      const response = await fetch("/api/auth/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, captchaToken, next }),
      });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error(result.error || "Unable to start sign-in.");
      window.location.assign(result.url);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to start sign-in.");
      onAttempt();
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2.5">
      {providers.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          disabled={busy !== null}
          onClick={() => start(id)}
          className="w-full rounded-lg border bg-white py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy === id ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
          {label}
        </button>
      ))}
    </div>
  );
}
