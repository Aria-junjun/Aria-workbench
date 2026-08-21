"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Truck,
  Package,
  CheckSquare,
  Lightbulb,
  FlaskConical,
  FolderKanban,
  BookOpen,
  Settings,
  ShieldCheck,
  LogOut
} from "lucide-react";
import { useState, useEffect } from "react";
import Image from "next/image";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "工作台",
    items: [
      { href: "/", label: "首页", icon: LayoutDashboard }
    ]
  },
  {
    title: "产品全周期管理",
    items: [
      { href: "/tasks", label: "待办提醒", icon: CheckSquare },
      { href: "/products", label: "产品进程", icon: Lightbulb },
      { href: "/product-master", label: "入仓产品", icon: Package },
      { href: "/projects", label: "品类项目", icon: FolderKanban }
    ]
  },
  {
    title: "供应商管理",
    items: [
      { href: "/suppliers", label: "供应商档案", icon: Truck },
      { href: "/offers", label: "货盘报价", icon: Package }
    ]
  },
  {
    title: "储备区",
    items: [
      { href: "/knowledge", label: "商业知识", icon: BookOpen },
      { href: "/research", label: "产品调研", icon: FlaskConical }
    ]
  },
  {
    title: "系统",
    items: [
      { href: "/settings", label: "系统设置", icon: Settings }
    ]
  }
];

const DEFAULT_AVATAR = "/images/avatar.jpg";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showLogout, setShowLogout] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(DEFAULT_AVATAR);

  useEffect(() => {
    fetch("/api/avatar")
      .then((r) => r.json())
      .then((data: { url: string | null }) => {
        if (data.url) {
          setAvatarUrl(data.url);
        } else {
          setAvatarUrl(DEFAULT_AVATAR);
        }
      })
      .catch(() => setAvatarUrl(DEFAULT_AVATAR));

    // 监听设置页面的头像变化
    function handleAvatarUpdate(evt: Event) {
      const customEvt = evt as CustomEvent<string>;
      if (customEvt.detail) {
        setAvatarUrl(customEvt.detail);
      } else {
        setAvatarUrl(DEFAULT_AVATAR);
      }
    }
    window.addEventListener("workbench:avatar-updated", handleAvatarUpdate);
    return () => window.removeEventListener("workbench:avatar-updated", handleAvatarUpdate);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-[clamp(256px,15vw,290px)] z-30 border-r border-line bg-surface md:flex md:flex-col">
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-action to-action-strong text-white shadow-glow">
            <Image
              alt="Aria"
              className="h-full w-full object-cover"
              height={44}
              src={avatarUrl}
              width={44}
              unoptimized
              onError={() => setAvatarUrl(DEFAULT_AVATAR)}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-base font-bold leading-tight tracking-wide">Aria的工作台</span>
            <span className="mt-0.5 text-[11px] text-muted-light font-medium">商业 · 供应链</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-5">
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-light">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`
                        group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                        transition-all duration-200
                        ${isActive
                          ? "bg-action-soft text-action"
                          : "text-muted hover:bg-paper-warm hover:text-ink"
                        }
                      `}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                        <Icon className={`h-[18px] w-[18px] transition-colors ${isActive ? "text-action" : "text-muted-light group-hover:text-ink"}`} />
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isActive ? "bg-action" : "bg-transparent"}`} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom user area */}
        <div className="border-t border-line px-3 py-3">
          <div className="group/user relative">
            <button
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all hover:bg-paper-warm"
              onClick={() => setShowLogout(!showLogout)}
            >
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                <Image
                  alt="Aria"
                  className="h-full w-full object-cover"
                  height={32}
                  src={avatarUrl}
                  width={32}
                  unoptimized
                  onError={() => setAvatarUrl(DEFAULT_AVATAR)}
                />
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs font-semibold text-ink">Aria</p>
                <p className="text-[10px] text-muted-light">Aria的工作台</p>
              </div>
              <ShieldCheck className="h-4 w-4 text-muted-light" />
            </button>
            {showLogout ? (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border border-line bg-surface p-1 shadow-card">
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted hover:bg-paper-warm hover:text-danger transition-colors"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 overflow-hidden rounded-xl">
              <Image
                alt="Aria"
                className="h-full w-full object-cover"
                height={32}
                src={avatarUrl}
                width={32}
                unoptimized
                onError={() => setAvatarUrl(DEFAULT_AVATAR)}
              />
            </div>
            <span className="font-display text-sm font-bold tracking-wide">Aria的工作台</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="md:pl-[clamp(256px,15vw,290px)]">
        <div className="mx-auto max-w-[1230px] px-4 py-6 md:px-8 md:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}
