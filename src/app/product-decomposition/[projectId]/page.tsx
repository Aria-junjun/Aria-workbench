"use client";

import { useParams } from "next/navigation";
import { DecompositionWorkspace } from "@/components/workbench/product-decomposition/decomposition-workspace";
import { loadProductDecompositionProjects } from "@/features/workbench/local-store";

export default function ProductDecompositionWorkspacePage() {
  const params = useParams<{ projectId: string }>();
  const project = loadProductDecompositionProjects().find((item) => item.id === params.projectId);
  if (!project) return <div className="rounded-2xl border border-danger/30 bg-surface p-6 text-sm text-danger">找不到这个产品拆解项目，请返回产品拆解首页。</div>;
  return <DecompositionWorkspace project={project} />;
}
