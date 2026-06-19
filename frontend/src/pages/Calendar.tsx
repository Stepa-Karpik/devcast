import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { PageHeader } from "../components/Layout";
import { fmtTime } from "../lib/time";

interface DayBucket {
  date: string;
  commits: {
    id: string;
    sha: string;
    repo: string;
    message: string;
    time: string;
  }[];
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
        subtitle="Коммиты по датам и времени"
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Calendar grid (left) */}
        <div className="card p-4">
          <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-[var(--color-muted)]">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const iso = toISO(cell);
              const bucket = byDate[iso];
              const count = bucket?.commits.length || 0;
              const repos = bucket
                ? [...new Set(bucket.commits.map((c) => c.repo.split("/").pop() || c.repo))]
                : [];
              const isPicked = picked === iso;
              return (
                <button
                  key={i}
                  onClick={() => count && setPicked(iso)}
                  className={`flex aspect-square flex-col gap-1 overflow-hidden rounded-xl border p-2 text-left transition ${
                    isPicked
                      ? "border-white/60 bg-[var(--color-panel-2)]"
                      : count
                        ? "border-[var(--color-line)] bg-[var(--color-panel-2)] hover:border-white/40"
                        : "border-[var(--color-line)]/40 text-neutral-600"
                  }`}
                >
                  <span className="text-xs">{cell.getDate()}</span>
                  {count > 0 && (
                    <>
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white">
                        {count} ●
                      </span>
                      <span className="hidden truncate text-[10px] leading-tight text-[var(--color-muted)] sm:block">
                        {repos.slice(0, 2).join(", ")}
                        {repos.length > 2 ? ` +${repos.length - 2}` : ""}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel (right) */}
        <div className="card p-5 lg:sticky lg:top-6 lg:h-fit">
          {pickedBucket ? (
            <>
              <h3 className="mb-4 font-semibold capitalize">
                {new Date(picked!).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                })}
                <span className="ml-2 text-sm font-normal text-[var(--color-muted)]">
                  {pickedBucket.commits.length} коммит(ов)
                </span>
              </h3>
              <ul className="space-y-3">
                {pickedBucket.commits.map((c) => (
                  <li key={c.id} className="border-l border-[var(--color-line)] pl-3">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      <span>{fmtTime(c.time)}</span>
                      <code>{c.sha}</code>
                    </div>
                    <div className="mt-0.5 text-xs text-white/80">{c.repo}</div>
                    <div className="mt-0.5 text-sm">{c.message}</div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="grid h-40 place-items-center text-center text-sm text-[var(--color-muted)]">
              Выберите день с активностью,
              <br />
              чтобы увидеть коммиты
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// Monday-first month grid with leading/trailing blanks.
function buildMonth(monthStart: Date): (Date | null)[] {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
