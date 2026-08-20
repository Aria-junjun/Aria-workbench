import type { LocalWorkbenchData } from "./local-store";

const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };

export type DashboardItemKind = "supplier" | "offer" | "product" | "knowledge" | "communication" | "decision";

export type DashboardItem = {
  id: string;
  kind: DashboardItemKind;
  title: string;
  summary: string;
  href: string;
  createdAt: string;
  pinned?: boolean;
};

export type DashboardView = {
  openTasks: LocalWorkbenchData["tasks"];
  pinnedItems: DashboardItem[];
  recentItems: DashboardItem[];
  recentCommunications: DashboardItem[];
  recentDecisions: DashboardItem[];
};

export function getDashboardView(data: LocalWorkbenchData): DashboardView {
  const openTasks = data.tasks
    .filter((task) => task.status === "open")
    .sort((a, b) => {
      const priorityDifference = (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3);
      return priorityDifference || compareDates(b.createdAt, a.createdAt);
    });

  const allItems = [
    ...data.suppliers.map((supplier): DashboardItem => ({
      id: supplier.id,
      kind: "supplier",
      title: supplier.name,
      summary: supplier.categories.join("、") || supplier.location || "供应商记录",
      href: `/suppliers/${supplier.id}`,
      createdAt: supplier.createdAt,
      pinned: supplier.pinned
    })),
    ...data.offers.map((offer): DashboardItem => ({
      id: offer.id,
      kind: "offer",
      title: offer.name,
      summary: offer.quotedPrice || offer.keySpecs || offer.category || "货盘记录",
      href: `/offers/${offer.id}`,
      createdAt: offer.createdAt,
      pinned: offer.pinned
    })),
    ...data.products.map((product): DashboardItem => ({
      id: product.id,
      kind: "product",
      title: product.name,
      summary: product.materials || product.keyParameters || product.process || "产品知识记录",
      href: `/products/${product.id}`,
      createdAt: product.createdAt,
      pinned: product.pinned
    })),
    ...data.knowledgeCards.map((card): DashboardItem => ({
      id: card.id,
      kind: "knowledge",
      title: card.title,
      summary: card.summary || card.tags.join("、") || "商业知识卡",
      href: `/knowledge/${card.id}`,
      createdAt: card.createdAt,
      pinned: card.pinned
    }))
  ];

  const sortPinnedItems = (items: DashboardItem[]) =>
    items.sort((a, b) => compareDates(b.createdAt, a.createdAt));

  const sortRecentItems = (items: DashboardItem[]) => items.sort((a, b) => compareDates(b.createdAt, a.createdAt));

  const communications = data.communications
    .sort((a, b) => compareDates(b.createdAt, a.createdAt))
    .slice(0, 5)
    .map((item): DashboardItem => ({
      id: item.id,
      kind: "communication",
      title: item.summary?.slice(0, 40) || "沟通记录",
      summary: item.nextActions.slice(0, 2).join("；") || "无后续行动",
      href: `/suppliers/${item.supplierId || ""}`,
      createdAt: item.createdAt
    }));

  const decisions = data.decisionCases
    .sort((a, b) => compareDates(b.createdAt, a.createdAt))
    .slice(0, 5)
    .map((item): DashboardItem => ({
      id: item.id,
      kind: "decision",
      title: item.title,
      summary: item.objective || `${item.cycles.length} 个决策轮次`,
      href: `/knowledge/cases/${item.id}`,
      createdAt: item.createdAt
    }));

  return {
    openTasks,
    pinnedItems: sortPinnedItems(allItems.filter((item) => item.pinned)),
    recentItems: sortRecentItems([...allItems]).slice(0, 8),
    recentCommunications: communications,
    recentDecisions: decisions
  };
}

function compareDates(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime();
}
