"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAuth, getAuth } from "@/lib/storage";

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`block rounded-xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[color:var(--nu-purple)] text-white"
          : "bg-white border border-black/10 text-black/70 hover:bg-black/5"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const auth = getAuth();

  const isStudent = auth?.role === "student";
  const isInstructor = auth?.role === "instructor";

  return (
    <div className="min-h-screen bg-[#F7F6FB]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto max-w-5xl px-6 sm:px-10 lg:px-16 py-6 flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold">CodeCoach</div>
            <div className="text-sm text-black/50">Academic workspace</div>
          </div>

          <div className="text-right">
            <div className="text-xs text-black/50">Signed in as</div>
            <div className="text-sm font-semibold">{auth?.email ?? "—"}</div>
            <button
              className="mt-2 btn-secondary text-xs"
              onClick={() => {
                clearAuth();
                router.replace("/");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 sm:px-10 lg:px-16 py-10 grid grid-cols-12 gap-10">
        <aside className="col-span-12 md:col-span-3 space-y-3">
          <NavItem href="/dashboard" label="Dashboard" />
          {isStudent ? <NavItem href="/student" label="My Courses" /> : null}
          {isStudent ? <NavItem href="/student/profile" label="My Profile" /> : null}
          {isInstructor ? <NavItem href="/instructor" label="My Courses" /> : null}
          <NavItem href="/settings" label="Settings" />
        </aside>

        <main className="col-span-12 md:col-span-9 space-y-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          </div>

          <div className="card p-6 sm:p-8 overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}