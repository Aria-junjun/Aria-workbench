import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { DataSyncLoader } from "@/components/data-sync-loader";
import { ThemeLoader } from "@/components/theme-loader";
import "./globals.css";

export const metadata: Metadata = {
  title: "个人商业工作台",
  description: "AI 辅助的个人供应链与商业知识资产工作台"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <ThemeLoader />
        <DataSyncLoader />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
