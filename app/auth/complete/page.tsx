"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import AuthLayout, { Notice } from "@/components/auth/auth-layout";
import { createClient, setActiveOrganizationId } from "@/lib/auth";
import { AUTH_ERROR_MESSAGES } from "@/lib/auth-config";

/**
 * Completes implicit-flow links (tokens in the URL fragment), e.g. admin
 * invitations sent by inviteUserByEmail with the default email template.
 */
export default function AuthCompletePage() {
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);

      const hashError = hash.get("error_description") || hash.get("error_code");
      if (hashError) {
        setError(AUTH_ERROR_MESSAGES.link_expired);
        return;
      }

      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const type = hash.get("type") || "";

      // Drop tokens from the address bar and history immediately.
      window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

      const supabase = createClient();
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          setError(AUTH_ERROR_MESSAGES.link_expired);
          return;
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setError(AUTH_ERROR_MESSAGES.missing_code);
          return;
        }
      }

      const response = await fetch("/api/auth/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, next: query.get("next") }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || AUTH_ERROR_MESSAGES.session_error);
        return;
      }
      if (result.organizationId) setActiveOrganizationId(result.organizationId);
      window.location.replace(result.redirectTo || "/dashboard");
    })().catch(() => setError(AUTH_ERROR_MESSAGES.session_error));
  }, []);

  return (
    <AuthLayout>
      {error ? (
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold">Sign-in could not be completed</h2>
          <Notice tone="error">{error}</Notice>
          <Link href="/login" className="block text-sm text-slate-700 hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Loader2 size={18} className="animate-spin" /> Completing sign-in…
        </div>
      )}
    </AuthLayout>
  );
}
