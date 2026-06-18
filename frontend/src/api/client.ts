import axios from "axios";

export const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";

export const api = axios.create({ baseURL: API_BASE });

const TOKEN_KEY = "devcast_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && getToken()) {
      clearToken();
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    return Promise.reject(err);
  },
);

// ---- Types ----
export interface User {
  id: string;
  email: string;
  display_name: string | null;
}
export interface Provider {
  id: string;
  provider: string;
  model: string | null;
  enabled: boolean;
  is_default: boolean;
  has_key: boolean;
  key_hint: string;
}
export interface ModelInfo {
  id: string;
  label: string;
}
export interface CatalogEntry {
  provider: string;
  label: string;
  models: ModelInfo[];
  needs_key: boolean;
}
export interface Integration {
  id: string;
  kind: string;
  meta: Record<string, any>;
}
export interface Repo {
  id: string;
  github_full_name: string;
  installation_id: string | null;
  branches: string[];
  sync_frequency: string;
  notion_target_id: string | null;
  notion_target_type: string | null;
  provider_id: string | null;
  active: boolean;
}
export interface Change {
  headline: string | null;
  bullets: string[];
  provider: string | null;
  model: string | null;
}
export interface Commit {
  id: string;
  repository_id: string;
  sha: string;
  branch: string | null;
  author: string | null;
  message: string;
  url: string | null;
  committed_at: string | null;
  status: string;
  synced_to_notion: boolean;
  change: Change | null;
}
export interface NotionTarget {
  id: string;
  title: string;
  type: string;
}
