"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Role = "student" | "instructor";

export default function RequireAuth({ children }: any) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user?.email) {
        router.replace("/");
        return;
      }

      const { data: row, error } = await supabase
        .from("users")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      if (error) {
        // if something is wrong, fail safe to login
        router.replace("/");
        return;
      }

      const role = row?.role as Role | undefined;

      // If role missing, you can either:
      // - send them to settings
      // - or just allow (not recommended)
      if (!role) {
        router.replace("/dashboard");
        return;
      }

      const isInstructorPath = pathname.startsWith("/instructor");
      const isStudentPath = pathname.startsWith("/student");

      if (isInstructorPath && role !== "instructor") {
        router.replace("/student");
        return;
      }
      if (isStudentPath && role !== "student") {
        router.replace("/instructor");
        return;
      }

      setLoading(false);
    }

    check();
  }, [router, pathname]);

  if (loading) return null;
  return children;
}