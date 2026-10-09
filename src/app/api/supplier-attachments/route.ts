import { NextResponse } from 'next/server';
import { requireWorkbenchSession } from '@/features/auth/guard';
import { saveSupplierAttachment } from '@/features/workbench/supplier-attachments-server';
export const runtime = 'nodejs';
export async function POST(request: Request) { const authError = await requireWorkbenchSession(request); if (authError) return authError; try { const file = (await request.formData()).get('file'); if (!(file instanceof File)) return NextResponse.json({ error: '请选择附件' }, { status: 400 }); return NextResponse.json({ attachment: await saveSupplierAttachment(file) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : '附件保存失败' }, { status: 400 }); } }
