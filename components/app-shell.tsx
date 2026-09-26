"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, BookOpen, CheckSquare, ChevronDown, ClipboardCheck, FileText, LayoutDashboard, LogOut, Search, Server, ShieldCheck, Users, Tags } from "lucide-react";
import { createClient, getCurrentProfile } from "@/lib/auth";
import { can, PERMISSIONS } from "@/lib/rbac";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" as const },
  { href: "/activities", label: "Activities", icon: ClipboardCheck, permission: "activities" as const },
  { href: "/evidence", label: "Evidence", icon: FileText, permission: "evidence" as const },
  { href: "/policies", label: "Policies", icon: BookOpen, permission: "policies" as const },
  { href: "/vulnerabilities", label: "Vulnerabilities", icon: AlertTriangle, permission: "vulnerabilities" as const },
  { href: "/assets", label: "Assets", icon: Server, permission: "assets" as const },
  { href: "/access-reviews", label: "Access Reviews", icon: CheckSquare, permission: "accessReviews" as const },
];

const adminNav = [
  { href: "/settings/users", label: "Users & Roles", icon: Users, permission: "users" as const },
  { href: "/settings/activity-categories", label: "Activity Categories", icon: Tags, permission: "activityCategories" as const },
];

export default function AppShell({ children, requiredPermission }: { children: React.ReactNode; requiredPermission?: keyof typeof PERMISSIONS }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [userEmail, setUserEmail] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getCurrentProfile().then(({ user, profile }) => {
      if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      setUserEmail(user?.email || "");
      setProfile(profile);
    });
  }, [pathname, router]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  const role = profile?.role;
  const unauthorized = !!profile && !!requiredPermission && !can(role, requiredPermission);
  const visibleNav = nav.filter(n => can(role, n.permission));
  const visibleAdmin = adminNav.filter(n => can(role, n.permission));
  const initials = (profile?.full_name || userEmail || "U").split(" ").map((x:string)=>x[0]).slice(0,2).join("").toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#f7f8fa]">
      <aside className="w-64 bg-white border-r min-h-screen p-5 flex flex-col">
        <div className="flex items-center gap-2 text-xl font-bold mb-8"><ShieldCheck size={22}/> AuditOps</div>
        <div className="space-y-1 flex-1">
          {visibleNav.map(n => <NavItem key={n.href} {...n} active={pathname === n.href} />)}
          {visibleAdmin.length > 0 && <>
            <div className="pt-7 pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Administration</div>
            {visibleAdmin.map(n => <NavItem key={n.href} {...n} active={pathname === n.href} />)}
          </>}
        </div>
        <div className="border-t pt-4 text-xs text-gray-400">Compliance Operations Platform</div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-sm text-gray-400"><Search size={16}/><span>Search workspace</span></div>
          <div className="relative">
            <button onClick={()=>setMenuOpen(!menuOpen)} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-semibold">{initials}</div>
              <div className="text-left hidden sm:block"><div className="text-sm font-medium">{profile?.full_name || "User"}</div><div className="text-[11px] text-gray-400">{role || "Loading…"}</div></div>
              <ChevronDown size={15} className="text-gray-400"/>
            </button>
            {menuOpen && <div className="absolute right-0 top-11 w-60 bg-white border rounded-xl shadow-lg p-2 z-50">
              <div className="px-3 py-2 border-b mb-1"><div className="text-sm font-medium truncate">{userEmail}</div><div className="text-xs text-gray-400 mt-1">{profile?.organization_id ? "Organization member" : "Profile not configured"}</div></div>
              {can(role, "users") && <Link href="/settings/users" onClick={()=>setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50"><Users size={15}/> Users & Roles</Link>}
              <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 text-red-600"><LogOut size={15}/> Sign out</button>
            </div>}
          </div>
        </header>
        <main className="p-8">{unauthorized ? <div className="max-w-xl mx-auto mt-16 bg-white border rounded-xl p-8 text-center"><div className="mx-auto h-11 w-11 rounded-full bg-red-50 text-red-600 grid place-items-center"><ShieldCheck size={20}/></div><h1 className="text-xl font-semibold mt-4">Access denied</h1><p className="text-sm text-gray-500 mt-2">Your AuditOps role does not have permission to access this area.</p><Link href="/dashboard" className="inline-block mt-5 rounded-lg bg-slate-950 text-white px-4 py-2 text-sm">Return to Dashboard</Link></div> : children}</main>
      </div>
    </div>
  );
}

function NavItem({ href, label, icon: Icon, active }: any) {
  return <Link href={href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-slate-100 text-slate-950 font-medium" : "text-gray-600 hover:bg-gray-100"}`}><Icon size={17}/>{label}</Link>;
}
