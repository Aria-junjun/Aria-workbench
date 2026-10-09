"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { loadDemandConfirmationDocuments } from "@/features/workbench/local-store";
import { DocumentWorkspace } from "./document-workspace";

function resolveDocumentId(id: string): string | undefined {
  const documents = loadDemandConfirmationDocuments();
  if (documents.some((document) => document.id === id)) return id;
  const legacyId = id.startsWith("legacy-") ? id : `legacy-${id}`;
  return documents.find((document) => document.id === legacyId)?.id;
}

/** Keeps old demand routes readable while sending them into the single document workflow. */
export function DemandDocumentRoute({ documentId }: { documentId: string }) {
  const router = useRouter();
  const resolvedId = useMemo(() => resolveDocumentId(documentId), [documentId]);

  useEffect(() => {
    if (!resolvedId) router.replace("/demand-exploration");
  }, [resolvedId, router]);

  if (!resolvedId) return <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">正在查找需求文档…</div>;
  return <DocumentWorkspace documentId={resolvedId} />;
}

export function LegacyDemandRouteRedirect({ documentId }: { documentId: string }) {
  const router = useRouter();
  const resolvedId = useMemo(() => resolveDocumentId(documentId), [documentId]);

  useEffect(() => {
    router.replace(resolvedId ? `/demand-exploration/${resolvedId}/items` : "/demand-exploration");
  }, [resolvedId, router]);

  return <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-muted">正在切换到统一的需求文档流程…</div>;
}
