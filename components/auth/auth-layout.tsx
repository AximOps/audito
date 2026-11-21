import { ShieldCheck } from "lucide-react";

/** Shared two-column frame for sign-in, sign-up and recovery screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-[#f7f8fa]">
      <section className="hidden lg:flex bg-slate-950 text-white p-12 flex-col justify-between">
        <div className="flex items-center gap-2 text-xl font-bold">
          <ShieldCheck size={23} /> AuditOps
        </div>
        <div className="max-w-lg">
          <div className="text-sm text-slate-400 mb-4">COMPLIANCE OPERATIONS PLATFORM</div>
          <h1 className="text-5xl font-semibold tracking-tight leading-tight">Always audit ready.</h1>
          <p className="text-slate-300 mt-5 text-lg leading-7">
            Centralize compliance activities, evidence, vulnerabilities, access reviews and audit
            work in one workspace.
          </p>
        </div>
        <div className="text-xs text-slate-500">Protected by role-based access control</div>
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 text-xl font-bold mb-10">
            <ShieldCheck size={23} /> AuditOps
          </div>
          <div className="bg-white border rounded-2xl p-8 shadow-sm">{children}</div>
        </div>
      </section>
    </main>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles =
    tone === "error"
      ? "bg-red-50 border-red-100 text-red-700"
      : tone === "success"
        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
        : "bg-blue-50 border-blue-100 text-blue-800";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border text-sm p-3 ${styles}`}>
      {children}
    </div>
  );
}
