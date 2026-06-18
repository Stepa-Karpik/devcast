import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Integration } from "../api/client";
import { PageHeader } from "../components/Layout";

export default function Integrations() {
  const qc = useQueryClient();
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: async () => (await api.get<Integration[]>("/api/integrations")).data,
  });
  const has = (kind: string) => integrations.data?.some((i) => i.kind === kind);

  return (
    <div>
      <PageHeader
        title="Интеграции"
        subtitle="Подключите источники данных: GitHub для коммитов, Notion для роадмапа, Google Calendar для активности"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <GitHubCard connected={!!has("github")} />
        <NotionCard
          connected={!!has("notion")}
          onChange={() => qc.invalidateQueries({ queryKey: ["integrations"] })}
        />
        <GoogleCard connected={!!has("google")} />
      </div>
    </div>
  );
}

function Shell({
  icon,
  title,
  desc,
  connected,
  children,
}: any) {
  return (
    <div className="card flex flex-col p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-3xl">{icon}</div>
        {connected ? (
          <span className="badge bg-emerald-500/15 text-emerald-300">подключено</span>
        ) : (
          <span className="badge bg-slate-500/15 text-slate-400">не подключено</span>
        )}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 mb-4 flex-1 text-sm text-[var(--color-muted)]">{desc}</p>
      {children}
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
    <Shell
      icon="🐙"
      title="GitHub"
      desc="Установите GitHub App, чтобы получать коммиты через webhooks и читать диффы."
      connected={connected}
    >
      <button onClick={() => connect.mutate()} className="btn-primary w-full">
        {connected ? "Переустановить App" : "Установить GitHub App"}
      </button>
    </Shell>
  );
}

function NotionCard({
  connected,
  onChange,
}: {
  connected: boolean;
  onChange: () => void;
}) {
  const [token, setToken] = useState("");
  const save = useMutation({
    mutationFn: async () =>
      (await api.post("/api/integrations/notion", { token })).data,
    onSuccess: () => {
      setToken("");
      onChange();
    },
    onError: () => alert("Неверный Notion-токен"),
  });
  return (
    <Shell
      icon="📝"
      title="Notion"
      desc="Internal integration token. Дайте интеграции доступ к нужным страницам в Notion."
      connected={connected}
    >
      <input
        className="input mb-2"
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder={connected ? "обновить токен (secret_…)" : "secret_…"}
      />
      <button
        disabled={!token || save.isPending}
        onClick={() => save.mutate()}
        className="btn-ghost w-full"
      >
        {connected ? "Обновить токен" : "Подключить"}
      </button>
    </Shell>
  );
}

function GoogleCard({ connected }: { connected: boolean }) {
  const connect = useMutation({
    mutationFn: async () =>
      (await api.get<{ url: string }>("/api/calendar/oauth/url")).data,
    onSuccess: (d) => (location.href = d.url),
    onError: (e: any) =>
      alert(e.response?.data?.detail || "Google не сконфигурирован на сервере"),
  });
  return (
    <Shell
      icon="🗓️"
      title="Google Calendar"
      desc="Необязательно. Пуш коммитов в отдельный календарь активности проекта."
      connected={connected}
    >
      <button onClick={() => connect.mutate()} className="btn-ghost w-full">
        {connected ? "Переподключить" : "Подключить Google"}
      </button>
    </Shell>
  );
}
