import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

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

interface Pos {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
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
  const [pos, setPos] = useState<Pos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const computePos = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - r.bottom - gap;
    const spaceAbove = r.top - gap;
    const desired = 320;
    // Flip up only when there isn't enough room below but there is above.
    const up = spaceBelow < Math.min(desired, 220) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(desired, up ? spaceAbove : spaceBelow));
    setPos({
      left: r.left,
      width: r.width,
      top: up ? undefined : r.bottom + gap,
      bottom: up ? window.innerHeight - r.top + gap : undefined,
      maxHeight,
    });
  };

  useLayoutEffect(() => {
    if (open) computePos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => computePos();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

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
      if (!vals.length) return <span className="text-neutral-600">{placeholder}</span>;
      return (
        <span className="truncate">
          {vals.map((v) => options.find((o) => o.value === v)?.label || v).join(", ")}
        </span>
      );
    }
    const opt = options.find((o) => o.value === (props.value as string));
    if (!opt) return <span className="text-neutral-600">{placeholder}</span>;
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
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-[var(--color-panel-2)] px-3 py-2 text-left text-sm outline-none transition disabled:opacity-40 ${
          open ? "border-white/40" : "border-[var(--color-line)]"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel()}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-neutral-500 transition ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              top: pos.top,
              bottom: pos.bottom,
              maxHeight: pos.maxHeight,
            }}
            className="z-[1000] flex flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-panel)] shadow-2xl shadow-black/60"
          >
            {searchable && (
              <div className="border-b border-[var(--color-line)] p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск…"
                  className="w-full rounded-lg bg-[var(--color-panel-2)] px-3 py-1.5 text-sm outline-none placeholder:text-neutral-600"
                />
              </div>
            )}
            <div className="flex-1 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-neutral-600">
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
                          ? "bg-white/10 text-white"
                          : "text-slate-200 hover:bg-[var(--color-panel-2)]"
                      }`}
                    >
                      {o.icon}
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.hint && (
                        <span className="shrink-0 text-xs text-neutral-500">{o.hint}</span>
                      )}
                      {active && (
                        <svg
                          className="h-4 w-4 shrink-0 text-white"
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
          </div>,
          document.body,
        )}
    </div>
  );
}
