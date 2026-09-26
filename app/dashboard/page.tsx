"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ClipboardCheck,
  FileText,
  Plus,
  Server,
  ShieldCheck,
} from "lucide-react";

import AppShell from "@/components/app-shell";
import { createClient, getCurrentProfile } from "@/lib/auth";
import { can } from "@/lib/rbac";
import type { Activity, Vulnerability } from "@/lib/types";
import type {
  Activity,
  Vulnerability,
} from "@/lib/types";

export default function Dashboard() {
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const { profile } = await getCurrentProfile();

      setProfile(profile);

      const supabase = createClient();

      const { data: activityData } = await supabase
        .from("compliance_activities")
        .select(
          "id,title,category,status,priority,due_date,owner:user_profiles!owner_id(full_name)"
        )
        .order("due_date", {
          ascending: true,
          nullsFirst: false,
        })
        .limit(5);

      const { data: vulnerabilityData } = await supabase
        .from("vulnerabilities")
        .select(
          "id,title,cve,severity,status,due_date,asset:assets!asset_id(name)"
        )
        .in("status", ["Open", "In Progress"])
        .order("due_date", {
          ascending: true,
          nullsFirst: false,
        })
        .limit(5);

      if (activityData) {
        setActivities(activityData as unknown as Activity[]);
      }

      if (vulnerabilityData) {
        setVulns(vulnerabilityData as unknown as Vulnerability[]);
      }

      setLoading(false);
    }

    loadDashboard();
  }, []);

  return (
    <AppShell requiredPermission="dashboard">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold">
              Dashboard
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Your compliance posture at a glance.
            </p>
          </div>

          <Link
            href="/activities"
            className={`rounded-lg bg-gray-900 text-white px-4 py-2 text-sm flex items-center gap-2 ${
              can(profile?.role, "activities")
                ? ""
                : "hidden"
            }`}
          >
            <Plus size={16} />
            New Task
          </Link>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            [
              "Open Findings",
              "12",
              "Needs attention",
            ],
            [
              "Open Vulnerabilities",
              "21",
              "Across all assets",
            ],
            [
              "Overdue Tasks",
              "4",
              "Past due date",
            ],
            [
              "Tasks Completed",
              "72",
              "This period",
            ],
          ].map((item) => (
            <div
              key={item[0]}
              className="bg-white rounded-xl border p-5"
            >
              <div className="text-sm text-gray-500">
                {item[0]}
              </div>

              <div className="text-3xl font-semibold mt-2">
                {item[1]}
              </div>

              <div className="text-xs text-gray-400 mt-1">
                {item[2]}
              </div>
            </div>
          ))}
        </section>

        {/* Main dashboard */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  Upcoming Tasks
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Tasks requiring attention.
                </p>
              </div>

              <Link
                href="/activities"
                className="text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                View all
              </Link>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-500">
                Loading tasks...
              </div>
            ) : activities.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">
                No tasks found.
              </div>
            ) : (
              <div className="divide-y">
                {activities.map((activity) => (
                  <Link
                    key={activity.id}
                    href={`/activities/${activity.id}`}
                    className="block px-5 py-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {activity.title}
                        </div>

                        <div className="text-xs text-gray-500 mt-1">
                          {activity.category}
                        </div>

                        {activity.owner?.full_name && (
                          <div className="text-xs text-gray-400 mt-1">
                            Owner: {activity.owner.full_name}
                          </div>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium">
                          {activity.priority}
                        </div>

                        {activity.due_date && (
                          <div className="text-xs text-gray-400 mt-1">
                            Due{" "}
                            {new Date(
                              activity.due_date
                            ).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                        {activity.status}
                      </span>

                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                        {activity.task_type}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Vulnerabilities */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-semibold">
                  Open Vulnerabilities
                </h2>

                <p className="text-xs text-gray-500 mt-1">
                  Vulnerabilities requiring attention.
                </p>
              </div>

              <Link
                href="/vulnerabilities"
                className="text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                View all
              </Link>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-gray-500">
                Loading vulnerabilities...
              </div>
            ) : vulns.length === 0 ? (
              <div className="p-6 text-sm text-gray-500">
                No open vulnerabilities found.
              </div>
            ) : (
              <div className="divide-y">
                {vulns.map((vulnerability) => (
                  <div
                    key={vulnerability.id}
                    className="px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">
                          {vulnerability.title}
                        </div>

                        {vulnerability.cve && (
                          <div className="text-xs text-gray-500 mt-1">
                            {vulnerability.cve}
                          </div>
                        )}

                        {vulnerability.asset?.name && (
                          <div className="text-xs text-gray-400 mt-1">
                            Asset:{" "}
                            {vulnerability.asset.name}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                          {vulnerability.severity}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-[11px] text-gray-600">
                        {vulnerability.status}
                      </span>

                      {vulnerability.due_date && (
                        <span className="text-xs text-gray-400">
                          Due{" "}
                          {new Date(
                            vulnerability.due_date
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Quick navigation */}
        <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickLink
            href="/activities"
            icon={<ClipboardCheck size={18} />}
            title="Tasks"
            description="Manage compliance tasks"
          />

          <QuickLink
            href="/evidence"
            icon={<FileText size={18} />}
            title="Evidence"
            description="Manage audit evidence"
          />

          <QuickLink
            href="/vulnerabilities"
            icon={<AlertTriangle size={18} />}
            title="Vulnerabilities"
            description="Track security issues"
          />

          <QuickLink
            href="/assets"
            icon={<Server size={18} />}
            title="Assets"
            description="Manage organizational assets"
          />
        </section>
      </div>
    </AppShell>
  );
}

function QuickLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border rounded-xl p-4 hover:bg-gray-50 transition"
    >
      <div className="flex items-center gap-2">
        <div className="text-gray-700">
          {icon}
        </div>

        <div className="font-medium text-sm">
          {title}
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-2">
        {description}
      </div>
    </Link>
  );
}