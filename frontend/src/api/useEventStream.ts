import { useEffect } from "react";
import { API_BASE, getToken } from "./client";

/** Subscribe to the server's SSE stream of live commit events. */
export function useEventStream(onEvent: (e: any) => void) {
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const es = new EventSource(
      `${API_BASE}/api/events/stream?token=${encodeURIComponent(token)}`,
    );
    const handler = (ev: MessageEvent) => {
      try {
        onEvent(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    };
    es.addEventListener("commit.processed", handler);
    es.addEventListener("commit.failed", handler);
    es.onerror = () => {
      /* EventSource auto-reconnects */
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
