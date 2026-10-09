import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'webp', 'xlsx', 'xls', 'csv', 'docx', 'txt']);
export type SupplierAttachmentMeta = { id: string; name: string; size: number; sha256: string; createdAt: string };
const SAFE_ID = /^[a-f0-9-]{20,80}$/i;
export function attachmentsRoot(root = process.cwd()) { return path.resolve(root, '.workbench-files', 'supplier-attachments'); }
function safeName(name: string) { return name.replace(/[\\/\0]/g, '_').replace(/[^\p{L}\p{N}._ ()-]/gu, '_').slice(0, 160) || 'attachment'; }
function ext(name: string) { return path.extname(name).slice(1).toLowerCase(); }
function checkedPath(id: string, suffix: string, root = process.cwd()) { if (!SAFE_ID.test(id)) throw new Error('invalid_attachment_id'); return path.join(attachmentsRoot(root), `${id}.${suffix}`); }
export function saveSupplierAttachment(file: { name: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> }, root = process.cwd()): Promise<SupplierAttachmentMeta> {
  const extension = ext(file.name);
  if (!ATTACHMENT_EXTENSIONS.has(extension)) return Promise.reject(new Error('不支持的附件格式'));
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > ATTACHMENT_MAX_BYTES) return Promise.reject(new Error('附件为空或超过20MB限制'));
  return file.arrayBuffer().then(buffer => {
    const bytes = Buffer.from(buffer); if (bytes.length === 0 || bytes.length > ATTACHMENT_MAX_BYTES) throw new Error('附件大小不合法');
    const id = crypto.randomUUID(); const dir = attachmentsRoot(root); fs.mkdirSync(dir, { recursive: true });
    const metadata: SupplierAttachmentMeta = { id, name: safeName(file.name), size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), createdAt: new Date().toISOString() };
    fs.writeFileSync(checkedPath(id, 'bin', root), bytes, { flag: 'wx' }); fs.writeFileSync(checkedPath(id, 'json', root), JSON.stringify(metadata), { flag: 'wx' }); return metadata;
  });
}
export function readSupplierAttachment(id: string, root = process.cwd()) { const metadata = JSON.parse(fs.readFileSync(checkedPath(id, 'json', root), 'utf8')) as SupplierAttachmentMeta; return { metadata, bytes: fs.readFileSync(checkedPath(id, 'bin', root)) }; }
export function collectSupplierAttachmentFiles(root = process.cwd()) { const dir = attachmentsRoot(root); if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir).filter(n => n.endsWith('.bin') || n.endsWith('.json')).map(name => ({ relativePath: path.posix.join('.workbench-files/supplier-attachments', name), absolutePath: path.join(dir, name) })); }
