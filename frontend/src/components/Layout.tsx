import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { logos } from "./logos";
import {
  IconCalendar,
  IconFeed,
  IconIntegrations,
  IconLogout,
  IconOperator,
  IconRepos,
} from "./icons";

const NAV = [
  { to: "/", label: "Лента", Icon: IconFeed, end: true },
  { to: "/repos", label: "Репозитории", Icon: IconRepos },
  { to: "/integrations", label: "Интеграции", Icon: IconIntegrations },
  { to: "/operator", label: "Оператор", Icon: IconOperator },
  { to: "/calendar", label: "Календарь", Icon: IconCalendar },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen">
      {/* Static sidebar — pinned to the left, always visible while content scrolls. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-panel)]/40 px-4 py-6 backdrop-blur md:flex">
        <div className="mb-10 flex items-center gap-3 px-2">
          <img src={logos.devcast} alt="DevCast" className="h-9 w-9" />
          <div>
            <div className="text-[15px] font-semibold leading-tight tracking-tight">
              DevCast
            </div>
            <div className="text-[11px] text-[var(--color-muted)]">
              live dev translation
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-[var(--color-panel-2)] text-white"
                    : "text-slate-400 hover:bg-[var(--color-panel-2)]/60 hover:text-slate-200"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`h-[18px] w-[18px] transition ${
                      isActive ? "text-[var(--color-accent)]" : ""
                    }`}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-[var(--color-line)] pt-4">
          <div className="truncate px-2 text-xs text-slate-300">{user?.email}</div>
          <button
            onClick={logout}
            className="mt-2 flex items-center gap-2 px-2 text-xs text-[var(--color-muted)] transition hover:text-white"
          >
            <IconLogout className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-5 py-6 md:px-10 md:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
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
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
