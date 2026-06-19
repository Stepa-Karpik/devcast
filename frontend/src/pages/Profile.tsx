import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { PageHeader } from "../components/Layout";
import { Select } from "../components/Select";
import { TIMEZONES } from "../lib/time";

export default function Profile() {
  const { user, refresh, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [tz, setTz] = useState(user?.timezone || "Europe/Moscow");

  const saveProfile = useMutation({
    mutationFn: async () =>
      (await api.patch("/api/auth/me", { display_name: displayName, timezone: tz })).data,
    onSuccess: async () => {
      await refresh();
      alert("Профиль сохранён");
    },
  });

  return (
    <div className="max-w-2xl">
      <PageHeader title="Профиль" subtitle={user?.email} />

      <div className="card mb-4 p-5">
        <h3 className="mb-4 font-semibold">Настройки</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Имя</label>
            <input
              className="input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="как к вам обращаться"
            />
          </div>
          <div>
            <label className="label">Часовой пояс</label>
            <Select options={TIMEZONES} value={tz} onChange={setTz} searchable />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Все даты и время в интерфейсе показываются в этом поясе.
            </p>
          </div>
          <button
            disabled={saveProfile.isPending}
            onClick={() => saveProfile.mutate()}
            className="btn-primary"
          >
            Сохранить
          </button>
        </div>
      </div>

      <ChangePassword />

      <div className="card mt-4 flex items-center justify-between p-5">
        <div>
          <div className="font-semibold">Выйти из аккаунта</div>
          <div className="text-sm text-[var(--color-muted)]">
            Завершить сессию на этом устройстве
          </div>
        </div>
        <button onClick={logout} className="btn-ghost text-red-300">
          Выйти
        </button>
      </div>
    </div>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const change = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/auth/change-password", {
          current_password: current,
          new_password: next,
        })
      ).data,
    onSuccess: () => {
      setCurrent("");
      setNext("");
      alert("Пароль изменён");
    },
    onError: (e: any) =>
      alert(e.response?.data?.detail || "Не удалось изменить пароль"),
  });

  return (
    <div className="card p-5">
      <h3 className="mb-4 font-semibold">Смена пароля</h3>
      <div className="space-y-3">
        <div>
          <label className="label">Текущий пароль</label>
          <input
            className="input"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Новый пароль</label>
          <input
            className="input"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="минимум 8 символов"
          />
        </div>
        <button
          disabled={!current || next.length < 8 || change.isPending}
          onClick={() => change.mutate()}
          className="btn-ghost"
        >
          Изменить пароль
        </button>
      </div>
    </div>
  );
}
