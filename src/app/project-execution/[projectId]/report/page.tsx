"use client";
import { use, useEffect, useState } from "react";
import { loadProjectExecutionProjects } from "@/features/workbench/local-store";
import type { ProjectExecutionProject } from "@/features/workbench/project-execution";
import { ProjectExecutionReport } from "@/components/workbench/project-execution/project-execution-report";
export default function ProjectExecutionReportPage({ params }: { params: Promise<{ projectId: string }> }) { const { projectId } = use(params); const [project, setProject] = useState<ProjectExecutionProject>(); useEffect(() => setProject(loadProjectExecutionProjects().find((item) => item.id === projectId)), [projectId]); return project ? <ProjectExecutionReport project={project} /> : <p className="text-sm text-muted">正在加载项目结果…</p>; }
