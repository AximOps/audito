import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen grid place-items-center bg-[#f7f8fa] p-6">
      <div className="max-w-md w-full bg-white border rounded-xl p-8 text-center">
        <div className="mx-auto h-11 w-11 rounded-full bg-red-50 text-red-600 grid place-items-center">
          <ShieldCheck size={20} />
        </div>
        <h1 className="text-xl font-semibold mt-4">Access denied</h1>
        <p className="text-sm text-gray-500 mt-2">
          Your role in the current organization does not include this area. Ask an Organization
          Admin if you need access.
        </p>
        <Link href="/dashboard" className="inline-block mt-5 rounded-lg bg-slate-950 text-white px-4 py-2 text-sm">
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
