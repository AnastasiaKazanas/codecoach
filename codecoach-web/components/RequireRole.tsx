"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function roleFromEmail(email: string): "student" | "instructor" {
  const e = (email || "").toLowerCase().trim();
  if (e.startsWith("instructor@")) return "instructor";
  return "student";
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let alive = true;

    async function checkRole() {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? "";

      if (!email) {
        router.replace("/");
        return;
      }

      const role = roleFromEmail(email);

      if (!alive) return;

      const isInstructorRoute = pathname.startsWith("/instructor");
      const isStudentRoute = pathname.startsWith("/student");

      if (role === "student" && isInstructorRoute) {
        router.replace("/student");
        return;
      }

      if (role === "instructor" && isStudentRoute) {
        router.replace("/instructor");
        return;
      }

      setChecked(true);
    }

    checkRole();
    return () => {
      alive = false;
    };
  }, [pathname, router]);

  if (!checked) return null;

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}