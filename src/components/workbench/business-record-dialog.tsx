'use client';
import React, { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const businessInput = 'mt-2 block min-h-11 w-full rounded-md border-0 bg-paper px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-action/40';
export const businessPrimary = 'inline-flex items-center justify-center rounded-md bg-action px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';
export const businessSecondary = 'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm text-muted hover:bg-paper hover:text-ink';

/** One window pattern for procurement and supplier records; forms stay separate from facts. */
export function BusinessRecordDialog({ title, onClose, children, footer, contentKey }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; contentKey?: string;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, []);
  return createPortal(<div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/25 p-3 backdrop-blur-[2px] sm:p-6">
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-surface text-ink shadow-2xl outline-none">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-8">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className={businessSecondary} aria-label="关闭窗口">关闭 ×</button>
      </header>
      <div key={contentKey} className="min-h-0 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">{children}</div>
      {footer && <footer className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4 sm:px-8">{footer}</footer>}
    </div>
  </div>, document.body);
}

export function BusinessSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="py-5 first:pt-0"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h3 className="border-l-2 border-action pl-3 font-semibold">{title}</h3>{action}</div>{children}</section>;
}

export function BusinessFacts({ values }: { values: Array<[string, ReactNode]> }) {
  return <dl className="grid gap-x-8 gap-y-5 text-sm sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="min-w-0"><dt className="mb-2 text-xs text-muted">{label}</dt><dd className="whitespace-pre-wrap break-words leading-6">{value === '' || value == null ? <span className="text-muted">未采集</span> : value}</dd></div>)}</dl>;
}

export function BusinessTextField({ label, value, onChange, multiline = false }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <label className="block text-sm">{label}{multiline ? <textarea className={businessInput} rows={3} value={value} onChange={e => onChange(e.target.value)} /> : <input className={businessInput} value={value} onChange={e => onChange(e.target.value)} />}</label>;
}
export function BusinessListField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <BusinessTextField label={label} value={values.join('\n')} multiline onChange={value => onChange(value.split(/\n/).map(v => v.trim()).filter(Boolean))} />;
}
