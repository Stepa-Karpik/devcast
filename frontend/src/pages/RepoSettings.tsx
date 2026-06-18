import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type NotionTarget,
  type Provider,
  type Repo,
} from "../api/client";
import { PageHeader } from "../components/Layout";

const FREQ = [
  { v: "realtime", l: "Каждый коммит (real-time)" },
  { v: "daily", l: "Раз в день" },
  { v: "weekly", l: "Раз в неделю" },
];

interface GhRepo {
  full_name: string;
  default_branch: string;
  installation_id: string;
  private: boolean;
}

export default function RepoSettings() {
  const qc = useQueryClient();
  const repos = useQuery({
    queryKey: ["repos"],
    queryFn: async () => (await api.get<Repo[]>("/api/repos")).data,
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: async () => (await api.get<Provider[]>("/api/operator/providers")).data,
  });
  const targets = useQuery({
    queryKey: ["notion-targets"],
    queryFn: async () =>
      (await api.get<NotionTarget[]>("/api/integrations/notion/targets")).data,
    retry: false,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["repos"] });

  return (
    <div>
      <PageHeader
        title="Репозитории"
        subtitle="Привяжите репозитории к страницам Notion и настройте частоту синхронизации"
      />
      <AddRepo
        providers={providers.data || []}
        targets={targets.data || []}
        onAdded={invalidate}
      />
      <div className="mt-6 space-y-4">
        {repos.data?.length === 0 && (
          <div className="card p-8 text-center text-[var(--color-muted)]">
            Пока нет репозиториев. Добавьте первый выше.
          </div>
        )}
        {repos.data?.map((r) => (
          <RepoCard
            key={r.id}
            repo={r}
            providers={providers.data || []}
            targets={targets.data || []}
            onChange={invalidate}
          />
        ))}
      </div>
    </div>
  );
}

function AddRepo({
  providers,
  targets,
  onAdded,
}: {
  providers: Provider[];
  targets: NotionTarget[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ghRepos = useQuery({
    queryKey: ["gh-repos"],
    queryFn: async () => (await api.get<GhRepo[]>("/api/integrations/github/repos")).data,
    enabled: open,
    retry: false,
  });
  const [sel, setSel] = useState("");
  const [freq, setFreq] = useState("realtime");
  const [target, setTarget] = useState("");
  const [provider, setProvider] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const gh = ghRepos.data?.find((g) => g.full_name === sel);
      const t = targets.find((x) => x.id === target);
      return (
        await api.post("/api/repos", {
          github_full_name: sel,
          installation_id: gh?.installation_id,
          branches: gh ? [gh.default_branch] : ["main"],
          sync_frequency: freq,
          notion_target_id: target || null,
          notion_target_type: t?.type || null,
          provider_id: provider || null,
        })
      ).data;
    },
    onSuccess: () => {
      setSel("");
      setOpen(false);
      onAdded();
    },
    onError: (e: any) => alert(e.response?.data?.detail || "Не удалось добавить"),
  });

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Подключить репозиторий
      </button>
    );

  return (
    <div className="card p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Репозиторий (из GitHub App)</label>
          {ghRepos.isLoading ? (
            <div className="input text-[var(--color-muted)]">Загрузка из GitHub…</div>
          ) : ghRepos.isError ? (
            <div className="input text-red-400">
              Сначала подключите GitHub в «Интеграциях»
            </div>
          ) : (
            <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
              <option value="">— выберите —</option>
              {ghRepos.data?.map((g) => (
                <option key={g.full_name} value={g.full_name}>
                  {g.full_name} {g.private ? "🔒" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="label">Частота синка в Notion</label>
          <select className="input" value={freq} onChange={(e) => setFreq(e.target.value)}>
            {FREQ.map((f) => (
              <option key={f.v} value={f.v}>
                {f.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Страница / база Notion</label>
          <select
            className="input"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">— без Notion —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.type === "database" ? "🗃 " : "📄 "}
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Обработчик ИИ</label>
          <select
            className="input"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="">По умолчанию</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.provider} · {p.model}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          disabled={!sel || add.isPending}
          onClick={() => add.mutate()}
          className="btn-primary"
        >
          Добавить
        </button>
        <button onClick={() => setOpen(false)} className="btn-ghost">
          Отмена
        </button>
      </div>
    </div>
  );
}

function RepoCard({
  repo,
  providers,
  targets,
  onChange,
}: {
  repo: Repo;
  providers: Provider[];
  targets: NotionTarget[];
  onChange: () => void;
}) {
  const patch = useMutation({
    mutationFn: async (body: Partial<Repo>) =>
      (await api.patch(`/api/repos/${repo.id}`, body)).data,
    onSuccess: onChange,
  });
  const sync = useMutation({
    mutationFn: async () => (await api.post(`/api/repos/${repo.id}/sync`)).data,
    onSuccess: () => alert("Синхронизация запущена — коммиты появятся в ленте."),
  });
  const del = useMutation({
    mutationFn: async () => (await api.delete(`/api/repos/${repo.id}`)).data,
    onSuccess: onChange,
  });

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{repo.github_full_name}</div>
          <div className="mt-0.5 text-xs text-[var(--color-muted)]">
            ветки: {repo.branches.join(", ") || "—"}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => sync.mutate()} className="btn-ghost px-3 py-1.5 text-xs">
            🔄 Sync now
          </button>
          <button
            onClick={() => confirm("Удалить репозиторий?") && del.mutate()}
            className="btn-ghost px-3 py-1.5 text-xs text-red-300"
          >
            Удалить
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="label">Частота синка</label>
          <select
            className="input"
            value={repo.sync_frequency}
            onChange={(e) => patch.mutate({ sync_frequency: e.target.value })}
          >
            {FREQ.map((f) => (
              <option key={f.v} value={f.v}>
                {f.l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Notion</label>
          <select
            className="input"
            value={repo.notion_target_id || ""}
            onChange={(e) => {
              const t = targets.find((x) => x.id === e.target.value);
              patch.mutate({
                notion_target_id: e.target.value || null,
                notion_target_type: t?.type || null,
              } as any);
            }}
          >
            <option value="">— без Notion —</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.type === "database" ? "🗃 " : "📄 "}
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Обработчик</label>
          <select
            className="input"
            value={repo.provider_id || ""}
            onChange={(e) => patch.mutate({ provider_id: e.target.value || null } as any)}
          >
            <option value="">По умолчанию</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.provider} · {p.model}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
