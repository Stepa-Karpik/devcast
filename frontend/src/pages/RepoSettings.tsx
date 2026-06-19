import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type NotionTarget,
  type Provider,
  type Repo,
} from "../api/client";
import { PageHeader } from "../components/Layout";
import { Select, type Option } from "../components/Select";

const FREQ: Option[] = [
  { value: "realtime", label: "Каждый коммит (real-time)" },
  { value: "daily", label: "Раз в день" },
  { value: "weekly", label: "Раз в неделю" },
];
const TRACKING: Option[] = [
  { value: "all", label: "Все коммиты", hint: "вся история" },
  { value: "fresh", label: "Только свежие", hint: "с момента подключения" },
];
const DEPTH: Option[] = [
  { value: "full", label: "Полная", hint: "всё, до портов и файлов" },
  { value: "technical", label: "Техническая", hint: "для разработчика" },
  { value: "simple", label: "Простая", hint: "для заказчика" },
];

interface GhRepo {
  full_name: string;
  default_branch: string;
  installation_id: string;
  private: boolean;
}

function notionOptions(targets: NotionTarget[]): Option[] {
  return targets.map((t) => ({
    value: t.id,
    label: t.title,
    hint: t.type === "database" ? "база" : "страница",
  }));
}
function providerOptions(providers: Provider[]): Option[] {
  return [
    { value: "", label: "По умолчанию" },
    ...providers.map((p) => ({ value: p.id, label: `${p.provider} · ${p.model}` })),
  ];
}

function useBranches(fullName: string, installationId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["branches", fullName, installationId],
    queryFn: async () =>
      (
        await api.get<string[]>("/api/integrations/github/branches", {
          params: { full_name: fullName, installation_id: installationId },
        })
      ).data,
    enabled: enabled && !!fullName && !!installationId,
    retry: false,
  });
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
        subtitle="Привяжите репозитории к страницам Notion и настройте, что и как отслеживать"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
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
  const [branches, setBranches] = useState<string[]>([]);
  const [freq, setFreq] = useState("realtime");
  const [tracking, setTracking] = useState("all");
  const [depth, setDepth] = useState("technical");
  const [target, setTarget] = useState("");
  const [provider, setProvider] = useState("");

  const selected = ghRepos.data?.find((g) => g.full_name === sel);
  const branchQuery = useBranches(sel, selected?.installation_id || null, !!sel);

  function selectRepo(fullName: string) {
    setSel(fullName);
    const g = ghRepos.data?.find((x) => x.full_name === fullName);
    setBranches(g ? [g.default_branch] : ["main"]);
  }

  const add = useMutation({
    mutationFn: async () => {
      const t = targets.find((x) => x.id === target);
      return (
        await api.post("/api/repos", {
          github_full_name: sel,
          installation_id: selected?.installation_id,
          branches: branches.length ? branches : ["main"],
          sync_frequency: freq,
          tracking_mode: tracking,
          summary_depth: depth,
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

  const repoOptions: Option[] =
    ghRepos.data?.map((g) => ({
      value: g.full_name,
      label: g.full_name,
      hint: g.private ? "private" : undefined,
    })) || [];
  const branchOptions: Option[] = (branchQuery.data || []).map((b) => ({
    value: b,
    label: b,
  }));

  return (
    <div className="card p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Репозиторий (из GitHub App)">
          {ghRepos.isError ? (
            <div className="input text-red-400">
              Сначала подключите GitHub в «Интеграциях»
            </div>
          ) : (
            <Select
              options={repoOptions}
              value={sel}
              onChange={selectRepo}
              searchable
              placeholder={ghRepos.isLoading ? "Загрузка из GitHub…" : "— выберите —"}
            />
          )}
        </Field>
        <Field label="Ветки для отслеживания">
          <Select
            multiple
            options={branchOptions}
            value={branches}
            onChange={setBranches}
            searchable
            disabled={!sel}
            placeholder={branchQuery.isLoading ? "Загрузка веток…" : "выберите ветки"}
            emptyText="Нет веток"
          />
        </Field>
        <Field label="Какие коммиты отслеживать">
          <Select options={TRACKING} value={tracking} onChange={setTracking} />
        </Field>
        <Field label="Глубина коммита">
          <Select options={DEPTH} value={depth} onChange={setDepth} />
        </Field>
        <Field label="Частота синка в Notion">
          <Select options={FREQ} value={freq} onChange={setFreq} />
        </Field>
        <Field label="Страница / база Notion">
          <Select
            options={[{ value: "", label: "— без Notion —" }, ...notionOptions(targets)]}
            value={target}
            onChange={setTarget}
            searchable
            placeholder="поиск по страницам…"
          />
        </Field>
        <Field label="Обработчик ИИ">
          <Select
            options={providerOptions(providers)}
            value={provider}
            onChange={setProvider}
          />
        </Field>
      </div>
      <div className="mt-5 flex gap-2">
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
  const [editBranches, setEditBranches] = useState(false);
  const branchQuery = useBranches(
    repo.github_full_name,
    repo.installation_id,
    editBranches,
  );

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

  const branchOptions: Option[] = (
    branchQuery.data || repo.branches
  ).map((b) => ({ value: b, label: b }));

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
            Sync now
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
        <Field label="Ветки">
          <Select
            multiple
            options={branchOptions}
            value={repo.branches}
            onChange={(v) => patch.mutate({ branches: v } as any)}
            searchable
            placeholder="ветки"
            emptyText={branchQuery.isLoading ? "Загрузка…" : "Нет веток"}
          />
          {!editBranches && (
            <button
              onClick={() => setEditBranches(true)}
              className="mt-1 text-[11px] text-[var(--color-muted)] hover:text-slate-300"
            >
              обновить список веток
            </button>
          )}
        </Field>
        <Field label="Какие коммиты">
          <Select
            options={TRACKING}
            value={repo.tracking_mode}
            onChange={(v) => patch.mutate({ tracking_mode: v } as any)}
          />
        </Field>
        <Field label="Глубина коммита">
          <Select
            options={DEPTH}
            value={repo.summary_depth}
            onChange={(v) => patch.mutate({ summary_depth: v } as any)}
          />
        </Field>
        <Field label="Частота синка">
          <Select
            options={FREQ}
            value={repo.sync_frequency}
            onChange={(v) => patch.mutate({ sync_frequency: v } as any)}
          />
        </Field>
        <Field label="Notion">
          <Select
            options={[{ value: "", label: "— без Notion —" }, ...notionOptions(targets)]}
            value={repo.notion_target_id || ""}
            onChange={(v) => {
              const t = targets.find((x) => x.id === v);
              patch.mutate({
                notion_target_id: v || null,
                notion_target_type: t?.type || null,
              } as any);
            }}
            searchable
            placeholder="поиск…"
          />
        </Field>
        <Field label="Обработчик">
          <Select
            options={providerOptions(providers)}
            value={repo.provider_id || ""}
            onChange={(v) => patch.mutate({ provider_id: v || null } as any)}
          />
        </Field>
      </div>
    </div>
  );
}
