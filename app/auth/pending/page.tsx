"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import AuthLayout from "@/components/auth/auth-layout";
import { clearActiveOrganizationId } from "@/lib/auth";

export default function PendingAccessPage() {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => undefined);
    clearActiveOrganizationId();
    window.location.assign("/login");
  }

  return (
    <AuthLayout>
      <div className="h-11 w-11 rounded-full bg-amber-50 text-amber-600 grid place-items-center">
        <Clock size={20} />
      </div>
      <h2 className="text-2xl font-semibold mt-4">Access pending</h2>
      <p className="text-sm text-gray-500 mt-2 leading-6">
        Your sign-in worked, but your account is not yet assigned to an organization. An
        administrator must approve your account and assign a role. You will be able to sign in
        once that is done.
      </p>
      <button
        onClick={signOut}
        disabled={busy}
        className="mt-6 w-full rounded-lg border py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
      >
        Sign out
      </button>
    </AuthLayout>
  );
}
