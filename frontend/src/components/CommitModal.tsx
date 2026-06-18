import type { Commit } from "../api/client";

export function CommitModal({
  commit,
  onClose,
}: {
  commit: Commit;
  onClose: () => void;
}) {
  const c = commit.change;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl overflow-hidden p-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[var(--color-line)] bg-[var(--color-panel-2)] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">
                {c?.headline || commit.message.split("\n")[0] || "Коммит"}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                <code className="rounded bg-[var(--color-ink)] px-1.5 py-0.5">
                  {commit.sha.slice(0, 7)}
                </code>
                {commit.branch && <span>· {commit.branch}</span>}
                {commit.author && <span>· {commit.author}</span>}
                {commit.committed_at && (
                  <span>· {new Date(commit.committed_at).toLocaleString("ru-RU")}</span>
                )}
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
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent-2)]" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : commit.status === "processed" ? (
            <p className="text-sm text-[var(--color-muted)]">Нет описанных изменений.</p>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">
              {commit.status === "failed"
                ? "Не удалось обработать этот коммит."
                : "Изменения ещё обрабатываются ИИ…"}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
            {c?.provider && (
              <span className="badge bg-[var(--color-panel-2)]">
                🧠 {c.provider} · {c.model}
              </span>
            )}
            {commit.synced_to_notion && (
              <span className="badge bg-[var(--color-panel-2)] text-[var(--color-accent-2)]">
                ✓ в Notion
              </span>
            )}
            {commit.url && (
              <a
                href={commit.url}
                target="_blank"
                className="badge bg-[var(--color-panel-2)] hover:text-white"
              >
                ↗ открыть на GitHub
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
