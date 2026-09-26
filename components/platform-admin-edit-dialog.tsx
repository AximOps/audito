"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

type UserStatus = "Active" | "Suspended";

type Props = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    job_title: string | null;
    status: UserStatus;
  };
  open: boolean;
  onClose: () => void;
  onSaved: (user: Props["user"]) => void;
  onError?: (message: string) => void;
};

export default function PlatformAdminEditDialog({
  user,
  open,
  onClose,
  onSaved,
  onError,
}: Props) {
  const [fullName, setFullName] = useState(user.full_name ?? "");
  const [email, setEmail] = useState(user.email);
  const [jobTitle, setJobTitle] = useState(user.job_title ?? "");
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setFullName(user.full_name ?? "");
    setEmail(user.email);
    setJobTitle(user.job_title ?? "");
    setStatus(user.status);

    let cancelled = false;

    async function load() {
      setLoading(true);

      try {
        const response = await fetch(`/api/platform/admins/${user.id}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error || "Failed to load Platform Admin."
          );
        }

        if (!cancelled && result.user) {
          setFullName(result.user.full_name ?? "");
          setEmail(result.user.email ?? "");
          setJobTitle(result.user.job_title ?? "");
          setStatus(
            result.platformAdmin?.status === "Suspended"
              ? "Suspended"
              : "Active"
          );
        }
      } catch (error) {
        onError?.(
          error instanceof Error
            ? error.message
            : "Failed to load Platform Admin."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [open, user.id]);

  if (!open) return null;

  async function save() {
    if (!fullName.trim()) {
      onError?.("Full name is required.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      onError?.("A valid email address is required.");
      return;
    }

    setSaving(true);
    onError?.("");

    try {
      const response = await fetch(`/api/platform/admins/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          jobTitle: jobTitle.trim(),
          status,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Failed to update Platform Admin."
        );
      }

      onSaved(result.user);
      onClose();
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : "Failed to update Platform Admin."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Edit Platform Admin
            </h2>
            <p className="text-sm text-gray-500">
              Update the administrator&apos;s profile and status.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              Loading Platform Admin...
            </div>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Email
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
                {email.trim().toLowerCase() !== user.email.toLowerCase() && (
                  <p className="text-xs text-amber-600">
                    Changing the email also updates the Supabase Auth
                    account and requires verification.
                  </p>
                )}
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Full Name
                </span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Job Title
                </span>
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-gray-700">
                  Status
                </span>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as UserStatus)
                  }
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </label>

              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                Platform Admin role is fixed for this screen. Passwords
                are not stored or edited in AuditOps; Supabase Auth handles
                authentication.
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-950 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving && (
              <Loader2 size={15} className="animate-spin" />
            )}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
