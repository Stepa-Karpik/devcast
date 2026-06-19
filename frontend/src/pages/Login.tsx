import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { logos } from "../components/logos";

export default function Login() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logos.devcast} alt="DevCast" className="mb-4 h-14 w-14" />
          <img src={logos.devcastText} alt="DevCast" className="h-8 w-auto" />
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Прямая трансляция разработки человеческим языком
          </p>
        </div>

        <form onSubmit={submit} className="card p-6">
          <div className="mb-4 flex rounded-xl bg-[var(--color-panel-2)] p-1 text-sm">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg py-1.5 transition ${
                  mode === m ? "bg-[var(--color-accent)] text-white" : "text-slate-400"
                }`}
              >
                {m === "login" ? "Вход" : "Регистрация"}
              </button>
            ))}
          </div>

          <label className="label">Email</label>
          <input
            className="input mb-3"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@company.com"
          />
          <label className="label">Пароль</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="минимум 8 символов"
          />

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          <button disabled={busy} className="btn-primary mt-5 w-full">
            {busy ? "…" : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}
