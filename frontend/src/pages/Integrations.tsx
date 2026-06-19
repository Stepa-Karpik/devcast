import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Integration } from "../api/client";
import { PageHeader } from "../components/Layout";
import { logos } from "../components/logos";

export default function Integrations() {
  const qc = useQueryClient();
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => (await api.get<Integration[]>("/api/integrations")).data,
  });
  const has = (kind: string) => integrations.data?.some((i) => i.kind === kind);
  const meta = (kind: string) =>
    integrations.data?.find((i) => i.kind === kind)?.meta || {};

  return (
    <div>
      <PageHeader
        title="Интеграции"
        subtitle="Подключите источники: GitHub для коммитов, Notion для роадмапа, Google Calendar для активности"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <GitHubCard connected={!!has("github")} />
        <NotionCard
          connected={!!has("notion")}
          workspace={meta("notion").workspace_name}
        />
        <GoogleCard connected={!!has("google")} />
      </div>
    </div>
  );
}

function Card({
  logo,
  title,
  desc,
  connected,
  badge,
  onClick,
  cta,
}: {
  logo: string;
  title: string;
  desc: string;
  connected: boolean;
  badge?: string;
  onClick: () => void;
  cta: string;
}) {
  return (
    <div className="card flex flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-panel-2)]">
          <img src={logo} alt={title} className="h-7 w-7 object-contain" />
        </div>
        {connected ? (
          <span className="badge bg-emerald-500/15 text-emerald-300">подключено</span>
        ) : (
          <span className="badge bg-slate-500/15 text-slate-400">не подключено</span>
        )}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 mb-4 flex-1 text-sm text-[var(--color-muted)]">{desc}</p>
      {badge && (
        <div className="mb-3 truncate text-xs text-[var(--color-accent-2)]">{badge}</div>
      )}
      <button onClick={onClick} className="btn-ghost w-full">
        {cta}
      </button>
    </div>
  );
}

function GitHubCard({ connected }: { connected: boolean }) {
  const connect = useMutation({
    mutationFn: async () =>
      (await api.get<{ url: string }>("/api/integrations/github/install-url")).data,
    onSuccess: (d) => (location.href = d.url),
    onError: (e: any) =>
      alert(e.response?.data?.detail || "GitHub App не сконфигурирован на сервере"),
  });
  return (
    <Card
      logo={logos.github}
      title="GitHub"
      desc="Установите GitHub App, чтобы получать коммиты через webhooks и читать диффы."
      connected={connected}
      onClick={() => connect.mutate()}
      cta={connected ? "Переустановить App" : "Установить GitHub App"}
    />
  );
}

function NotionCard({
  connected,
  workspace,
}: {
  connected: boolean;
  workspace?: string;
}) {
  const connect = useMutation({
    mutationFn: async () =>
      (await api.get<{ url: string }>("/api/integrations/notion/oauth/url")).data,
    onSuccess: (d) => (location.href = d.url),
    onError: (e: any) =>
      alert(e.response?.data?.detail || "Notion OAuth не сконфигурирован на сервере"),
  });
  return (
    <Card
      logo={logos.notion}
      title="Notion"
      desc="Авторизуйтесь через Notion — выберите свой workspace и страницы. Без вставки токенов."
      connected={connected}
      badge={connected && workspace ? `workspace: ${workspace}` : undefined}
      onClick={() => connect.mutate()}
      cta={connected ? "Переподключить Notion" : "Подключить Notion"}
    />
  );
}

function GoogleCard({ connected }: { connected: boolean }) {
  const qc = useQueryClient();
  const connect = useMutation({
    mutationFn: async () =>
      (await api.get<{ url: string }>("/api/calendar/oauth/url")).data,
    onSuccess: (d) => (location.href = d.url),
    onError: (e: any) =>
      alert(e.response?.data?.detail || "Google не сконфигурирован на сервере"),
  });

  const settings = useQuery({
    queryKey: ["calendar-settings"],
    queryFn: async () =>
      (await api.get<{ calendar_name: string }>("/api/calendar/settings")).data,
  });
  const [name, setName] = useState("");
  const saveName = useMutation({
    mutationFn: async () =>
      (await api.put("/api/calendar/settings", { calendar_name: name })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-settings"] });
      alert("Название календаря сохранено");
    },
  });
  const currentName = settings.data?.calendar_name || "DevCast";

  return (
    <div className="card flex flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--color-panel-2)]">
          <img src={logos.google} alt="Google" className="h-7 w-7 object-contain" />
        </div>
        {connected ? (
          <span className="badge bg-white/10 text-white">подключено</span>
        ) : (
          <span className="badge bg-white/5 text-[var(--color-muted)]">не подключено</span>
        )}
      </div>
      <h3 className="font-semibold">Google Calendar</h3>
      <p className="mt-1 mb-4 flex-1 text-sm text-[var(--color-muted)]">
        Коммиты попадают в отдельный календарь: заголовок, ссылка на репозиторий и описание.
      </p>

      {connected && (
        <div className="mb-3">
          <label className="label">Название календаря</label>
          <div className="flex gap-2">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={currentName}
            />
            <button
              disabled={!name || saveName.isPending}
              onClick={() => saveName.mutate()}
              className="btn-ghost shrink-0 px-3"
            >
              ОК
            </button>
          </div>
        </div>
      )}

      <button onClick={() => connect.mutate()} className="btn-ghost w-full">
        {connected ? "Переподключить" : "Подключить Google"}
      </button>
    </div>
  );
}
