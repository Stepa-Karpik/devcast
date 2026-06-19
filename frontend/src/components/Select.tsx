import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface Option {
  value: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
}

interface BaseProps {
  options: Option[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  emptyText?: string;
  className?: string;
}

interface SingleProps extends BaseProps {
  multiple?: false;
  value: string;
  onChange: (v: string) => void;
}
interface MultiProps extends BaseProps {
  multiple: true;
  value: string[];
  onChange: (v: string[]) => void;
}

export function Select(props: SingleProps | MultiProps) {
  const {
    options,
    placeholder = "Выберите…",
    searchable,
    disabled,
    emptyText = "Ничего не найдено",
    multiple,
    className = "",
  } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const selectedValues = multiple
    ? (props.value as string[])
    : props.value
      ? [props.value as string]
      : [];

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const triggerLabel = (): ReactNode => {
    if (multiple) {
      const vals = props.value as string[];
      if (!vals.length) return <span className="text-slate-500">{placeholder}</span>;
      const labels = vals
        .map((v) => options.find((o) => o.value === v)?.label || v)
        .join(", ");
      return <span className="truncate">{labels}</span>;
    }
    const opt = options.find((o) => o.value === (props.value as string));
    if (!opt) return <span className="text-slate-500">{placeholder}</span>;
    return (
      <span className="flex items-center gap-2 truncate">
        {opt.icon}
        {opt.label}
      </span>
    );
  };

  function pick(value: string) {
    if (multiple) {
      const vals = props.value as string[];
      const next = vals.includes(value)
        ? vals.filter((v) => v !== value)
        : [...vals, value];
      (props.onChange as (v: string[]) => void)(next);
    } else {
      (props.onChange as (v: string) => void)(value);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-panel-2)] px-3 py-2 text-left text-sm outline-none transition focus:border-[var(--color-accent)]/70 disabled:opacity-50 ${
          open ? "border-[var(--color-accent)]/70" : ""
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel()}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] shadow-2xl shadow-black/40">
          {searchable && (
            <div className="border-b border-[var(--color-line)] p-2">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск…"
                className="w-full rounded-lg bg-[var(--color-panel-2)] px-3 py-1.5 text-sm outline-none placeholder:text-slate-500"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                {emptyText}
              </div>
            ) : (
              filtered.map((o) => {
                const active = selectedValues.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => pick(o.value)}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-[var(--color-accent)]/15 text-white"
                        : "text-slate-200 hover:bg-[var(--color-panel-2)]"
                    }`}
                  >
                    {o.icon}
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && (
                      <span className="shrink-0 text-xs text-slate-500">{o.hint}</span>
                    )}
                    {active && (
                      <svg
                        className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
