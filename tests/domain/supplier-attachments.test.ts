import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { readSupplierAttachment, saveSupplierAttachment } from '@/features/workbench/supplier-attachments-server';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
it('saves and reads an attachment without putting it in public', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-files-')); dirs.push(root);
  const bytes = new TextEncoder().encode('source');
  const meta = await saveSupplierAttachment({ name: '报价.csv', size: bytes.length, arrayBuffer: async () => bytes.buffer }, root);
  expect(readSupplierAttachment(meta.id, root).bytes.toString()).toBe('source');
  expect(fs.existsSync(path.join(root, 'public'))).toBe(false);
});
it('rejects unsupported formats and traversal ids', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'supplier-files-')); dirs.push(root);
  await expect(saveSupplierAttachment({ name: 'run.exe', size: 1, arrayBuffer: async () => new Uint8Array([1]).buffer }, root)).rejects.toThrow();
  expect(() => readSupplierAttachment('../secret', root)).toThrow();
});
