const MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: "в очереди", cls: "bg-slate-500/15 text-slate-300" },
  processing: { label: "обработка", cls: "bg-amber-500/15 text-amber-300" },
  processed: { label: "готово", cls: "bg-emerald-500/15 text-emerald-300" },
  failed: { label: "ошибка", cls: "bg-red-500/15 text-red-300" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = MAP[status] || MAP.pending;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
