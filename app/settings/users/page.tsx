"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Shield,
  UserPlus,
  X,
} from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient, getCurrentProfile } from "@/lib/auth";
import { ROLE_OPTIONS, isAdmin } from "@/lib/rbac";

type UserRow = {
  id: string;
  full_name: string | null;
  job_title: string | null;
  role: string;
  status: string;
  created_at: string;
};

export default function UsersPage() {
  const [profile, setProfile] = useState<any>(null);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Invite user state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteJobTitle, setInviteJobTitle] = useState("");
  const [inviteRole, setInviteRole] = useState("Contributor");
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    setError("");

    const { profile: currentProfile } =
      await getCurrentProfile();

    setProfile(currentProfile);

    if (
      !currentProfile ||
      !isAdmin(currentProfile.role)
    ) {
      setLoading(false);
      return;
    }

    const { data, error: loadError } =
      await createClient()
        .from("user_profiles")
        .select(
          "id,full_name,job_title,role,status,created_at"
        )
        .eq(
          "organization_id",
          currentProfile.organization_id
        )
        .order("created_at");

    if (loadError) {
      setError(loadError.message);
      setRows([]);
    } else {
      setRows((data || []) as UserRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveRole(
    id: string,
    role: string
  ) {
    if (!profile || id === profile.id) {
      setError(
        "You cannot change your own role."
      );
      return;
    }

    setSaving(id);
    setMessage("");
    setError("");

    const { error: updateError } =
      await createClient()
        .from("user_profiles")
        .update({ role })
        .eq("id", id)
        .eq(
          "organization_id",
          profile.organization_id
        );

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(
        "Role updated successfully."
      );
    }

    await load();
    setSaving(null);
  }

  async function saveStatus(
    id: string,
    status: string
  ) {
    if (!profile || id === profile.id) {
      setError(
        "You cannot change your own account status."
      );
      return;
    }

    setSaving(id);
    setMessage("");
    setError("");

    const { error: updateError } =
      await createClient()
        .from("user_profiles")
        .update({ status })
        .eq("id", id)
        .eq(
          "organization_id",
          profile.organization_id
        );

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage(
        "User status updated successfully."
      );
    }

    await load();
    setSaving(null);
  }

  async function inviteUser() {
    setInviting(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(
        "/api/users/invite",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email: inviteEmail,
            fullName: inviteName,
            jobTitle: inviteJobTitle,
            role: inviteRole,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to invite user."
        );
      }

      setMessage(
        result.message ||
          "Invitation sent successfully."
      );

      // Reset form
      setInviteEmail("");
      setInviteName("");
      setInviteJobTitle("");
      setInviteRole("Contributor");

      setShowInvite(false);

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to invite user."
      );
    } finally {
      setInviting(false);
    }
  }

  function closeInviteModal() {
    if (inviting) {
      return;
    }

    setShowInvite(false);
    setInviteEmail("");
    setInviteName("");
    setInviteJobTitle("");
    setInviteRole("Contributor");
  }

  if (loading) {
    return (
      <AppShell requiredPermission="users">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white border rounded-xl p-8 text-sm text-gray-500">
            Loading users…
          </div>
        </div>
      </AppShell>
    );
  }

  if (
    !profile ||
    !isAdmin(profile.role)
  ) {
    return (
      <AppShell requiredPermission="users">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white border rounded-xl p-8">
            <h1 className="text-xl font-semibold text-gray-900">
              Access denied
            </h1>

            <p className="text-sm text-gray-500 mt-2">
              Only Organization Admins can
              manage users and roles.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell requiredPermission="users">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-end justify-between mb-7">
          <div>
            <h1 className="text-2xl font-semibold">
              Users & Roles
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Control who can view and manage
              each area of AuditOps.
            </p>
          </div>

          <button
            type="button"
            className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-800 transition"
            onClick={() => {
              setMessage("");
              setError("");
              setShowInvite(true);
            }}
          >
            <UserPlus size={16} />
            Invite User
          </button>
        </div>

        {/* RBAC information */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800 flex gap-3">
          <Shield
            size={18}
            className="shrink-0 mt-0.5"
          />

          <div>
            <strong>
              RBAC is enabled.
            </strong>{" "}
            Permissions are enforced in the
            database as well as the
            application UI.
          </div>
        </div>

        {/* Success message */}
        {message && (
          <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm flex items-center gap-2">
            <Check size={15} />
            {message}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">
            {error}
          </div>
        )}

        {/* Users */}
        <div className="bg-white border rounded-xl overflow-hidden">

          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">
              Organization members
            </h2>

            <p className="text-xs text-gray-500 mt-1">
              Assign the least-privileged role
              needed for each user.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="p-8 text-sm text-gray-500">
              No organization users found.
            </div>
          ) : (
            <div className="divide-y">

              {rows.map((user) => {
                const isCurrentUser =
                  user.id === profile.id;

                const initials =
                  (user.full_name || "U")
                    .split(" ")
                    .map(
                      (x: string) =>
                        x[0]
                    )
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                return (
                  <div
                    key={user.id}
                    className="px-5 py-4 flex items-center gap-5"
                  >

                    {/* Avatar */}
                    <div className="h-9 w-9 rounded-full bg-gray-100 grid place-items-center text-xs font-semibold shrink-0">
                      {initials}
                    </div>

                    {/* User */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {user.full_name ||
                          "Unnamed user"}

                        {isCurrentUser && (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        {user.job_title ||
                          "No job title"}
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      <select
                        value={user.role}
                        disabled={
                          saving ===
                            user.id ||
                          isCurrentUser
                        }
                        onChange={(event) =>
                          saveRole(
                            user.id,
                            event.target.value
                          )
                        }
                        className="border rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title={
                          isCurrentUser
                            ? "You cannot change your own role"
                            : "Change user role"
                        }
                      >
                        {ROLE_OPTIONS.map(
                          (role) => (
                            <option
                              key={role}
                              value={role}
                            >
                              {role}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {/* Status */}
                    <div>
                      <select
                        value={user.status}
                        disabled={
                          saving ===
                            user.id ||
                          isCurrentUser
                        }
                        onChange={(event) =>
                          saveStatus(
                            user.id,
                            event.target.value
                          )
                        }
                        className="border rounded-lg px-3 py-2 text-sm bg-white w-32 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title={
                          isCurrentUser
                            ? "You cannot change your own status"
                            : "Change user status"
                        }
                      >
                        <option value="Active">
                          Active
                        </option>

                        <option value="Suspended">
                          Suspended
                        </option>
                      </select>
                    </div>

                    {/* Saving indicator */}
                    {saving ===
                      user.id && (
                      <Loader2
                        size={16}
                        className="animate-spin text-gray-400"
                      />
                    )}
                  </div>
                );
              })}

            </div>
          )}
        </div>

        {/* Role explanation */}
        <div className="mt-6 bg-gray-50 border rounded-xl p-5">
          <h3 className="font-semibold text-sm">
            Available roles
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">

            <RoleDescription
              role="Organization Admin"
              description="Full access including organization and user administration."
            />

            <RoleDescription
              role="Compliance Manager"
              description="Manages compliance activities, policies, evidence, vendors and findings."
            />

            <RoleDescription
              role="Security Manager"
              description="Manages vulnerabilities, assets, access reviews and security findings."
            />

            <RoleDescription
              role="IT Manager"
              description="Manages assets, vulnerabilities and access reviews."
            />

            <RoleDescription
              role="Contributor"
              description="Performs day-to-day compliance and security activities."
            />

            <RoleDescription
              role="Auditor / Read Only"
              description="View-only access for audit and assessment activities."
            />

          </div>
        </div>

      </div>

      {/* Invite User Modal */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeInviteModal();
            }
          }}
        >
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Invite User
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Add a user to your AuditOps
                  organization.
                </p>
              </div>

              <button
                type="button"
                onClick={closeInviteModal}
                className="text-gray-400 hover:text-gray-700 transition"
                disabled={inviting}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-4">

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>

                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) =>
                    setInviteEmail(
                      event.target.value
                    )
                  }
                  placeholder="user@company.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-500"
                  disabled={inviting}
                  autoComplete="email"
                />
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full name
                </label>

                <input
                  type="text"
                  value={inviteName}
                  onChange={(event) =>
                    setInviteName(
                      event.target.value
                    )
                  }
                  placeholder="John Smith"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-500"
                  disabled={inviting}
                  autoComplete="name"
                />
              </div>

              {/* Job Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job title
                </label>

                <input
                  type="text"
                  value={inviteJobTitle}
                  onChange={(event) =>
                    setInviteJobTitle(
                      event.target.value
                    )
                  }
                  placeholder="Compliance Manager"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-500"
                  disabled={inviting}
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>

                <select
                  value={inviteRole}
                  onChange={(event) =>
                    setInviteRole(
                      event.target.value
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-500"
                  disabled={inviting}
                >
                  {ROLE_OPTIONS
                    .filter(
                      (role) =>
                        role !==
                        "Organization Admin"
                    )
                    .map((role) => (
                      <option
                        key={role}
                        value={role}
                      >
                        {role}
                      </option>
                    ))}
                </select>

                <p className="text-xs text-gray-500 mt-1">
                  Organization Admin access
                  should be assigned deliberately.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">

              <button
                type="button"
                onClick={closeInviteModal}
                disabled={inviting}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={inviteUser}
                disabled={
                  inviting ||
                  !inviteEmail.trim() ||
                  !inviteName.trim()
                }
                className="px-4 py-2 text-sm rounded-lg bg-slate-950 text-white hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
              >
                {inviting && (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                )}

                {inviting
                  ? "Sending..."
                  : "Send Invitation"}
              </button>

            </div>

          </div>
        </div>
      )}
    </AppShell>
  );
}

function RoleDescription({
  role,
  description,
}: {
  role: string;
  description: string;
}) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-sm font-medium">
        {role}
      </div>

      <div className="text-xs text-gray-500 mt-1">
        {description}
      </div>
    </div>
  );
}