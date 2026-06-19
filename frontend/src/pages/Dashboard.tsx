import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Commit, type Repo } from "../api/client";
import { PageHeader } from "../components/Layout";
import { StatusBadge } from "../components/StatusBadge";
import { CommitModal } from "../components/CommitModal";
import { Select } from "../components/Select";
import { useEventStream } from "../api/useEventStream";

export default function Dashboard() {
  const qc = useQueryClient();
  const [repoFilter, setRepoFilter] = useState<string>("");
  const [selected, setSelected] = useState<Commit | null>(null);

  const repos = useQuery({
    queryKey: ["repos"],
    queryFn: async () => (await api.get<Repo[]>("/api/repos")).data,
  });

  const commits = useQuery({
    queryKey: ["commits", repoFilter],
    queryFn: async () =>
      (
        await api.get<Commit[]>("/api/commits", {
          params: repoFilter ? { repository_id: repoFilter } : {},
        })
      ).data,
    refetchInterval: 15000,
  });

  // Live refresh when the worker finishes a commit.
  useEventStream(() => {
    qc.invalidateQueries({ queryKey: ["commits"] });
  });

  const repoName = (id: string) =>
    repos.data?.find((r) => r.id === id)?.github_full_name || "—";

  return (
    <div>
      <PageHeader
        title="Лента изменений"
        subtitle="Коммиты, переведённые на человеческий язык — в реальном времени"
        action={
          <div className="w-64">
            <Select
              options={[
                { value: "", label: "Все репозитории" },
                ...(repos.data?.map((r) => ({
                  value: r.id,
                  label: r.github_full_name,
                })) || []),
              ]}
              value={repoFilter}
              onChange={setRepoFilter}
              searchable
            />
          </div>
        }
      />

      {commits.isLoading ? (
        <div className="card p-10 text-center text-slate-400">Загрузка…</div>
      ) : !commits.data?.length ? (
        <div className="card p-10 text-center">
          <p className="text-slate-300">Пока нет коммитов.</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Подключите репозиторий и сделайте push — или нажмите «Sync now» в разделе
            Репозитории.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-line)] text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Изменение</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Репозиторий</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Когда</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody>
              {commits.data.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="cursor-pointer border-b border-[var(--color-line)]/60 transition last:border-0 hover:bg-[var(--color-panel-2)]/60"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {c.change?.headline || c.message.split("\n")[0] || c.sha.slice(0, 7)}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--color-muted)]">
                      <code>{c.sha.slice(0, 7)}</code>
                      {c.change?.bullets?.length ? (
                        <span>· {c.change.bullets.length} изменений</span>
                      ) : null}
                      {c.synced_to_notion && (
                        <span className="text-[var(--color-accent-2)]">· Notion ✓</span>
                      )}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--color-muted)] md:table-cell">
                    {repoName(c.repository_id)}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--color-muted)] sm:table-cell">
                    {c.committed_at
                      ? new Date(c.committed_at).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <CommitModal commit={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
