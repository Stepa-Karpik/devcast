import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Commit } from "../api/client";
import { fmtDateTime } from "../lib/time";

export function CommitModal({
  commit,
  repoHasNotion,
  onClose,
}: {
  commit: Commit;
  repoHasNotion: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const c = commit.change;
  const archived = commit.status === "skipped";
  const processing = commit.status === "processing" || commit.status === "pending";

  const process = useMutation({
    mutationFn: async () => (await api.post(`/api/commits/${commit.id}/process`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commits"] }),
  });
  const sendNotion = useMutation({
    mutationFn: async () =>
      (await api.post(`/api/commits/${commit.id}/send-to-notion`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commits"] }),
  });

  return (
    <div
      className="fixed inset-0 z-[1100] grid place-items-center bg-black/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--color-line)] bg-[var(--color-panel-2)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">
                {c?.headline || commit.message.split("\n")[0] || "Коммит"}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                <code className="rounded bg-[var(--color-ink)] px-1.5 py-0.5">
                  {commit.sha.slice(0, 7)}
                </code>
                {commit.branch && <span>· {commit.branch}</span>}
                {commit.author && <span>· {commit.author}</span>}
                {commit.committed_at && <span>· {fmtDateTime(commit.committed_at)}</span>}
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost px-2.5 py-1">
              ✕
            </button>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-5">
          <h3 className="label">Что сделано</h3>
          {c?.bullets?.length ? (
            <ul className="space-y-2">
              {c.bullets.map((b, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : archived ? (
            <p className="text-sm text-[var(--color-muted)]">
              Архивный коммит — описание ещё не сформировано. Нажмите «Обработать», чтобы
              получить человеческое описание изменений.
            </p>
          ) : commit.status === "failed" ? (
            <p className="text-sm text-red-400">Не удалось обработать этот коммит.</p>
          ) : commit.status === "processed" ? (
            <p className="text-sm text-[var(--color-muted)]">Нет описанных изменений.</p>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              Изменения обрабатываются ИИ…
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
            {c?.provider && (
              <span className="badge bg-[var(--color-panel-2)] text-[var(--color-muted)]">
                {c.provider} · {c.model}
              </span>
            )}
            <span
              className={`badge bg-[var(--color-panel-2)] ${
                commit.synced_to_notion ? "text-white" : "text-[var(--color-muted)]"
              }`}
            >
              {commit.synced_to_notion ? "✓ в Notion" : "не в Notion"}
            </span>
            {commit.url && (
              <a
                href={commit.url}
                target="_blank"
                className="badge bg-[var(--color-panel-2)] text-[var(--color-muted)] hover:text-white"
              >
                ↗ GitHub
              </a>
            )}
          </div>
        </div>

        {/* Actions: process an archived commit, then optionally send to Notion. */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-line)] bg-[var(--color-panel-2)] p-4">
          {archived && (
            <button
              disabled={process.isPending}
              onClick={() => process.mutate()}
              className="btn-primary"
            >
              {process.isPending ? "Запуск…" : "Обработать"}
            </button>
          )}
          {processing && !archived && (
            <span className="text-xs text-[var(--color-muted)]">обработка…</span>
          )}
          {commit.status === "processed" &&
            !commit.synced_to_notion &&
            repoHasNotion &&
            (c?.bullets?.length ?? 0) > 0 && (
              <button
                disabled={sendNotion.isPending}
                onClick={() => sendNotion.mutate()}
                className="btn-primary"
              >
                {sendNotion.isPending ? "Отправка…" : "Отправить в Notion"}
              </button>
            )}
        </div>
      </div>
    </div>
  );
}
