"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Shield,
  UserPlus,
} from "lucide-react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/auth";
import { ROLE_OPTIONS } from "@/lib/rbac";

type UserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  job_title: string | null;
  role: string;
  status: string;
  created_at: string;
};

export default function UsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState("Contributor");
  const [newStatus, setNewStatus] = useState("Active");
  const [adding, setAdding] = useState(false);

  const supabase = createClient();

  async function getActiveOrganizationId() {
    const local = window.localStorage.getItem("auditops_active_organization");
    if (local) return local;

    const { data, error: rpcError } = await supabase.rpc("current_org_id");
    if (rpcError) throw rpcError;
    return data as string | null;
  }

  async function load() {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You are not signed in.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    try {
      const orgId = await getActiveOrganizationId();

      if (!orgId) {
        setError("No active organization is selected.");
        setLoading(false);
        return;
      }

      setOrganizationId(orgId);

      const { data: role, error: roleError } = await supabase.rpc(
        "current_user_role"
      );

      if (roleError) {
        setError(roleError.message);
        setLoading(false);
        return;
      }

      setCurrentRole(role);

      if (role !== "Organization Admin" && role !== "Platform Admin") {
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error: loadError } = await supabase.rpc(
        "get_organization_members",
        { target_org: orgId }
      );

      if (loadError) {
        setError(loadError.message);
        setRows([]);
      } else {
        setRows((data || []) as UserRow[]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load users.");
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveMembership(
    userId: string,
    changes: { role?: string; status?: string }
  ) {
    if (!organizationId) return;

    if (userId === currentUserId) {
      setError("You cannot change your own organization role or status.");
      return;
    }

    setSaving(userId);
    setMessage("");
    setError("");

    const { error: updateError } = await supabase
      .from("organization_memberships")
      .update(changes)
      .eq("organization_id", organizationId)
      .eq("user_id", userId);

    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage("Organization membership updated successfully.");
    }

    await load();
    setSaving(null);
  }

  async function addExistingUser(event: FormEvent) {
    event.preventDefault();

    if (!organizationId) {
      setError("No active organization is selected.");
      return;
    }

    if (!email.trim()) {
      setError("Enter the user's email address.");
      return;
    }

    setAdding(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/users/membership", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": organizationId,
      },
      body: JSON.stringify({
        email: email.trim(),
        role: newRole,
        status: newStatus,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "Unable to add user.");
    } else {
      setMessage(
        `${email.trim()} has been added to this organization.`
      );
      setEmail("");
      setNewRole("Contributor");
      setNewStatus("Active");
      setShowAdd(false);
      await load();
    }

    setAdding(false);
  }

  const canManage =
    currentRole === "Organization Admin" ||
    currentRole === "Platform Admin";

  return (
    <AppShell requiredPermission="users">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-7">
          <div>
            <h1 className="text-2xl font-semibold">Users & Roles</h1>
            <p className="text-sm text-gray-500 mt-1">
              Manage organization membership and organization-specific roles.
            </p>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => {
                setShowAdd((value) => !value);
                setError("");
              }}
              className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm flex items-center gap-2 hover:bg-slate-800"
            >
              <UserPlus size={16} />
              Add Existing User
            </button>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800 flex gap-3">
          <Shield size={18} className="shrink-0 mt-0.5" />
          <div>
            <strong>Organization-level RBAC.</strong>{" "}
            A user can belong to multiple organizations and have a different
            role in each organization.
          </div>
        </div>

        {message && (
          <div className="mb-5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 text-sm flex items-center gap-2">
            <Check size={15} />
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-100 text-red-700 p-3 text-sm">
            {error}
          </div>
        )}

        {showAdd && canManage && (
          <form
            onSubmit={addExistingUser}
            className="bg-white border rounded-xl p-5 mb-5"
          >
            <h2 className="font-semibold">Add existing AuditOps user</h2>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              The user must already have an AuditOps login. This adds the login
              to the currently selected organization; it does not create a new
              Auth account.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <label className="md:col-span-2">
                <span className="text-sm font-medium">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-1.5 w-full border rounded-lg px-3 py-2.5"
                  placeholder="user@company.com"
                />
              </label>

              <label>
                <span className="text-sm font-medium">Role</span>
                <select
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value)}
                  className="mt-1.5 w-full border rounded-lg px-3 py-2.5 bg-white"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="text-sm font-medium">Status</span>
                <select
                  value={newStatus}
                  onChange={(event) => setNewStatus(event.target.value)}
                  className="mt-1.5 w-full border rounded-lg px-3 py-2.5 bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Invited">Invited</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="border rounded-lg px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                disabled={adding}
                className="rounded-lg bg-slate-950 text-white px-4 py-2 text-sm disabled:opacity-60 flex items-center gap-2"
              >
                {adding && <Loader2 size={15} className="animate-spin" />}
                {adding ? "Adding…" : "Add to Organization"}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold">Organization members</h2>
            <p className="text-xs text-gray-500 mt-1">
              Roles and status below apply only to the currently selected
              organization.
            </p>
          </div>

          {loading ? (
            <div className="p-8 text-sm text-gray-500">
              Loading organization members…
            </div>
          ) : !canManage ? (
            <div className="p-8 text-sm text-gray-500">
              Only Organization Admins can manage users and roles.
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-sm text-gray-500">
              No organization users found.
            </div>
          ) : (
            <div className="divide-y">
              {rows.map((user) => {
                const isCurrentUser = user.user_id === currentUserId;
                const initials = (user.full_name || "U")
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={user.user_id}
                    className="px-5 py-4 flex items-center gap-5"
                  >
                    <div className="h-9 w-9 rounded-full bg-gray-100 grid place-items-center text-xs font-semibold shrink-0">
                      {initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {user.full_name || "Unnamed user"}
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {user.email || "No email"}
                        {user.job_title ? ` · ${user.job_title}` : ""}
                      </div>
                    </div>

                    <select
                      value={user.role}
                      disabled={saving === user.user_id || isCurrentUser}
                      onChange={(event) =>
                        saveMembership(user.user_id, {
                          role: event.target.value,
                        })
                      }
                      className="border rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>

                    <select
                      value={user.status}
                      disabled={saving === user.user_id || isCurrentUser}
                      onChange={(event) =>
                        saveMembership(user.user_id, {
                          status: event.target.value,
                        })
                      }
                      className="border rounded-lg px-3 py-2 text-sm bg-white w-32 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="Active">Active</option>
                      <option value="Suspended">Suspended</option>
                      <option value="Invited">Invited</option>
                    </select>

                    {saving === user.user_id && (
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

        <div className="mt-6 bg-gray-50 border rounded-xl p-5">
          <h3 className="font-semibold text-sm">Available roles</h3>
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
      <div className="text-sm font-medium">{role}</div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
  );
}
