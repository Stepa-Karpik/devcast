import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { logos } from "./logos";
import {
  IconCalendar,
  IconFeed,
  IconIntegrations,
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
  const { user } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen">
      {/* Static sidebar — pinned to the left, always visible while content scrolls. */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--color-line)] bg-[var(--color-panel)] px-4 py-6 md:flex">
        <div className="mb-10 px-2 pt-1">
          <img src={logos.devcastText} alt="DevCast" className="h-7 w-auto" />
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
          <button
            onClick={() => navigate("/profile")}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[var(--color-panel-2)]"
            title="Профиль"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-panel-2)] text-xs font-semibold uppercase text-slate-300">
              {(user?.email || "?").slice(0, 1)}
            </span>
            <span className="min-w-0 truncate text-xs text-slate-300">
              {user?.email}
            </span>
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
