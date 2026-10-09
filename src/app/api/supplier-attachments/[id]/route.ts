import { NextResponse } from 'next/server';
import { requireWorkbenchSession } from '@/features/auth/guard';
import { readSupplierAttachment } from '@/features/workbench/supplier-attachments-server';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { const authError = await requireWorkbenchSession(request); if (authError) return authError; try { const { id } = await context.params; const { metadata, bytes } = readSupplierAttachment(id); return new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(bytes.length), 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }); } catch { return NextResponse.json({ error: '附件不存在' }, { status: 404 }); } }
