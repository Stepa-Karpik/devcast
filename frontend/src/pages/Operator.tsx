import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type CatalogEntry, type Provider } from "../api/client";
import { PageHeader } from "../components/Layout";
import { Select } from "../components/Select";

export default function Operator() {
  const qc = useQueryClient();
  const catalog = useQuery({
    queryKey: ["catalog"],
    queryFn: async () => (await api.get<CatalogEntry[]>("/api/operator/catalog")).data,
  });
  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: async () => (await api.get<Provider[]>("/api/operator/providers")).data,
  });

  const save = useMutation({
    mutationFn: async (body: any) => (await api.put("/api/operator/providers", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });

  const byProvider = (p: string) => providers.data?.find((x) => x.provider === p);

  return (
    <div>
      <PageHeader
        title="Оператор"
        subtitle="Выберите обработчик ИИ и модель. Ключ задаётся один раз и навсегда скрывается."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {catalog.data?.map((entry) => (
          <ProviderCard
            key={entry.provider}
            entry={entry}
            current={byProvider(entry.provider)}
            saving={save.isPending}
            onSave={(body) => save.mutate(body)}
          />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  entry,
  current,
  saving,
  onSave,
}: {
  entry: CatalogEntry;
  current?: Provider;
  saving: boolean;
  onSave: (body: any) => void;
}) {
  const [model, setModel] = useState(current?.model || entry.models[0]?.id || "");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(current?.enabled ?? true);

  const configured = current?.has_key;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{entry.label}</h3>
          {current?.is_default && (
            <span className="badge bg-[var(--color-accent)]/20 text-[var(--color-accent)]">
              по умолчанию
            </span>
          )}
        </div>
        {configured ? (
          <span className="badge bg-emerald-500/15 text-emerald-300">
            ключ задан · {current?.key_hint}
          </span>
        ) : (
          <span className="badge bg-slate-500/15 text-slate-400">не настроен</span>
        )}
      </div>

      <label className="label">Модель</label>
      <div className="mb-3">
        <Select
          options={entry.models.map((m) => ({ value: m.id, label: m.label }))}
          value={model}
          onChange={setModel}
        />
      </div>

      <label className="label">API-ключ {configured && "(оставьте пустым, чтобы не менять)"}</label>
      <input
        className="input"
        type="password"
        autoComplete="new-password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder={configured ? "•••••••• задан" : "вставьте ключ"}
      />

      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        Включён
      </label>

      <div className="mt-4 flex gap-2">
        <button
          disabled={saving}
          onClick={() =>
            onSave({
              provider: entry.provider,
              model,
              api_key: apiKey || undefined,
              enabled,
              is_default: current?.is_default ?? false,
            })
          }
          className="btn-ghost flex-1"
        >
          Сохранить
        </button>
        <button
          disabled={saving}
          onClick={() =>
            onSave({
              provider: entry.provider,
              model,
              api_key: apiKey || undefined,
              enabled: true,
              is_default: true,
            })
          }
          className="btn-primary flex-1"
        >
          Сделать основным
        </button>
      </div>
    </div>
  );
}
