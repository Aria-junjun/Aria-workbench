import React from 'react';

export function ProcurementFilter({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="flex items-center gap-3 text-sm"><span className="whitespace-nowrap text-muted">{label}</span><span className="relative"><select aria-label={label} className="h-10 min-w-40 appearance-none rounded-lg border border-line bg-surface py-2 pl-3 pr-9 text-ink outline-none focus:ring-2 focus:ring-action/40" value={value} onChange={event => onChange(event.target.value)}>{children}</select><span aria-hidden="true" className="pointer-events-none absolute right-3 top-2.5 text-muted">⌄</span></span></label>;
}
