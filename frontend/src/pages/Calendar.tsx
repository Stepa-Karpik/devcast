import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader } from "../components/Layout";

interface DayBucket {
  date: string;
  commits: { id: string; sha: string; message: string; time: string }[];
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export default function Calendar() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [picked, setPicked] = useState<string | null>(null);

  const data = useQuery({
    queryKey: ["calendar"],
    queryFn: async () => (await api.get<DayBucket[]>("/api/calendar/commits")).data,
  });

  const byDate = useMemo(() => {
    const m: Record<string, DayBucket> = {};
    data.data?.forEach((d) => (m[d.date] = d));
    return m;
  }, [data.data]);

  const cells = useMemo(() => buildMonth(cursor), [cursor]);
  const monthLabel = cursor.toLocaleString("ru-RU", { month: "long", year: "numeric" });
  const pickedBucket = picked ? byDate[picked] : null;

  return (
    <div>
      <PageHeader
        title="Календарь активности"
        subtitle="Все коммиты по датам и времени"
        action={
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost px-3 py-1.5"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              ←
            </button>
            <span className="min-w-40 text-center text-sm capitalize">{monthLabel}</span>
            <button
              className="btn-ghost px-3 py-1.5"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              →
            </button>
          </div>
        }
      />

      <div className="card p-4">
        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-[var(--color-muted)]">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((cell, i) => {
            if (!cell) return <div key={i} />;
            const iso = cell.toISOString().slice(0, 10);
            const bucket = byDate[iso];
            const count = bucket?.commits.length || 0;
            return (
              <button
                key={i}
                onClick={() => count && setPicked(iso)}
                className={`flex aspect-square flex-col rounded-xl border p-2 text-left transition ${
                  count
                    ? "border-[var(--color-accent)]/40 bg-[var(--color-panel-2)] hover:border-[var(--color-accent)]"
                    : "border-[var(--color-line)]/50 text-slate-500"
                }`}
              >
                <span className="text-xs">{cell.getDate()}</span>
                {count > 0 && (
                  <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] text-[var(--color-accent)]">
                    {count} ●
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {pickedBucket && (
        <div className="card mt-4 p-5">
          <h3 className="mb-3 font-semibold">
            {new Date(picked!).toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
            })}
            {" — "}
            {pickedBucket.commits.length} коммит(ов)
          </h3>
          <ul className="space-y-2">
            {pickedBucket.commits.map((c) => (
              <li key={c.id} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-[var(--color-muted)]">
                  {new Date(c.time).toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <code className="text-xs text-[var(--color-muted)]">{c.sha}</code>
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Monday-first month grid with leading/trailing blanks.
function buildMonth(monthStart: Date): (Date | null)[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
