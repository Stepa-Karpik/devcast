import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/", label: "Лента", icon: "📡", end: true },
  { to: "/repos", label: "Репозитории", icon: "📦" },
  { to: "/integrations", label: "Интеграции", icon: "🔌" },
  { to: "/operator", label: "Оператор", icon: "🧠" },
  { to: "/calendar", label: "Календарь", icon: "🗓️" },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] gap-6 p-4 md:p-6">
      <aside className="hidden w-60 shrink-0 flex-col md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-accent)] text-lg font-black text-white">
            D
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">DevCast</div>
            <div className="text-[11px] text-[var(--color-muted)]">
              live dev translation
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-[var(--color-panel-2)] text-white ring-1 ring-[var(--color-accent)]/40"
                    : "text-slate-400 hover:bg-[var(--color-panel)] hover:text-slate-200"
                }`
              }
            >
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 card p-3">
          <div className="truncate text-xs text-slate-300">{user?.email}</div>
          <button onClick={logout} className="mt-2 text-xs text-[var(--color-muted)] hover:text-white">
            Выйти →
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
