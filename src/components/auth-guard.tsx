"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";

const PUBLIC_ROUTES = ["/login"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const isPublic = PUBLIC_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );

    if (isPublic) {
      setChecking(false);
      return;
    }

    const isAuthed = sessionStorage.getItem("workbench_authenticated") === "true";
    if (!isAuthed) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
    } else {
      setChecking(false);
    }
  }, [pathname, router]);

  const isLogin = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (checking && !isLogin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-action border-t-transparent" />
          <div className="flex items-center gap-2 text-sm text-muted">
            <Sparkles className="h-4 w-4" />
            正在验证...
          </div>
        </div>
      </div>
    );
  }

  if (isLogin) {
    return <>{children}</>;
  }

  if (!checking) {
    return <AppShell>{children}</AppShell>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-action border-t-transparent" />
    </div>
  );
}
