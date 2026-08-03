"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Truck,
  Package,
  Lightbulb,
  CheckSquare,
  BookOpen,
  Settings,
  Sparkles,
  FlaskConical
} from "lucide-react";

const navItems = [
  { href: "/", label: "工作台", icon: LayoutDashboard },
  { href: "/intake", label: "快速录入", icon: Zap },
  { href: "/suppliers", label: "供应商库", icon: Truck },
  { href: "/offers", label: "货盘报价", icon: Package },
  { href: "/products", label: "产品知识", icon: Lightbulb },
  { href: "/research", label: "深度调研", icon: FlaskConical },
  { href: "/tasks", label: "待办事项", icon: CheckSquare },
  { href: "/knowledge", label: "商业知识", icon: BookOpen },
  { href: "/settings", label: "系统设置", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-line bg-surface md:block">
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-action to-action-strong text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-[15px] font-bold leading-tight tracking-wide">工作台</span>
            <span className="mt-0.5 text-[11px] text-muted-light font-medium">个人商业 · 供应链</span>
          </div>
        </div>

        {/* Decorative divider */}
        <div className="mx-4 mb-3 h-px bg-gradient-to-r from-transparent via-line to-transparent" />

        {/* Nav */}
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                  transition-all duration-200 ease-smooth
                  ${isActive
                    ? "bg-action-soft text-action shadow-glow"
                    : "text-muted hover:bg-paper-warm hover:text-ink"
                  }
                `}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-action" : "text-muted-light group-hover:text-ink"}`} />
                </span>
                <span className="w-16 truncate">{item.label}</span>
                <span className={`ml-auto h-2 w-2 rounded-full shrink-0 ${isActive ? "bg-action" : "bg-transparent"}`} />
              </Link>
            );
          })}
        </nav>

        {/* Bottom decorative area */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="rounded-2xl bg-paper-warm border border-line-soft p-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-action to-action-strong flex items-center justify-center text-white text-xs font-bold">
                S
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">供应链操盘手</p>
                <p className="text-[10px] text-muted-light">v1.0 · 温暖版</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-action to-action-strong text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-display text-sm font-bold tracking-wide">工作台</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="md:pl-60">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
