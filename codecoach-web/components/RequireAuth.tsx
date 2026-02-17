"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getAuth } from "@/lib/storage";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    if (!auth && pathname !== "/") {
      router.replace("/");
      return;
    }
    setReady(true);
  }, [router, pathname]);

  if (!ready) return null;
  return <>{children}</>;
}