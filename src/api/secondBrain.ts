/**
 * secondBrain.ts — Second Brain API client
 * =========================================
 * Talks to the FastAPI Second Brain router. Reuses the app's axios client (auth
 * headers, base URL). File upload uses multipart/form-data.
 *
 * Place at: frontend/src/api/secondBrain.ts
 */

import { api } from "./client";

export interface BrainConfig {
  role: string;
  role_label: string;
  can_upload: boolean;
  can_manage: boolean;
  folders: string[];
  workspace: string;
  archival_ready: boolean;
  kb_ready: boolean;
}

export interface BrainDoc {
  doc_id: string;
  workspace_id: string;
  folder: string;
  title: string;
  filename: string;
  doc_type: string;
  doc_kind: string;
  summary: string;
  key_decisions: string[];
  tags: string[];
  chunks: number;
  uploaded_by: string;
  source: string;
  source_url?: string;
  ingest_ok?: boolean;
  created_at?: string;
}

export interface Citation {
  n: number;
  doc_id: string;
  title: string;
  folder?: string;
  score?: number | null;
}

export interface AskResult {
  answer: string;
  citations: Citation[];
  confidence: "high" | "medium" | "low" | "none";
  grounded: boolean;
  chunks_found: number;
  knowledge_gap: boolean;
}

export interface FolderCount { folder: string; count: number; }

export interface BrainDashboard {
  workspace: string;
  documents_total: number;
  chunks_total: number;
  questions_total: number;
  questions_answered: number;
  knowledge_gaps: number;
  folders: FolderCount[];
  doc_kinds: { kind: string; count: number }[];
  popular_topics: { topic: string; count: number }[];
  recent_gaps: { question: string; asked_at: string }[];
  recent_questions: { question: string; grounded: boolean; confidence: string; asked_at: string }[];
}


export interface AvailableModel { id: string; name: string; provider: string; }

export interface ModelSetting {
  effective: string;
  source: "settings" | "env_or_default";
  stored: string | null;
  fallback: string;
}

export interface BrainSettings {
  enrich_model: ModelSetting;
  answer_model: ModelSetting;
}


export interface BrainConversationMeta {
  conversation_id: string;
  title: string;
  turn_count: number;
  updated_at: string;
  created_at: string;
}

export interface BrainTurn {
  question: string;
  answer: string;
  citations: Citation[];
  confidence: string;
  grounded: boolean;
  knowledge_gap: boolean;
  ts: number;
}

export interface BrainConversation {
  conversation_id: string;
  title: string;
  turns: BrainTurn[];
  created_at: string;
  updated_at: string;
}


export interface BrainConnector {
  connector_id: string;
  connector_type: string;
  name: string;
  enabled: boolean;
  last_synced: string | null;
  last_status: string;
  item_count: number;
  created_at: string;
  config: Record<string, string>;
}

export interface ConnectorTypeField {
  key: string; label: string; placeholder: string; secret: boolean;
}
export interface ConnectorType {
  type: string; label: string; fields: ConnectorTypeField[];
}
export interface SyncResult {
  connector_id: string; added: number; updated: number; unchanged: number;
  deleted: number; errors: number; status: string; total_items: number;
  error_details?: { title: string; error: string }[];
}

export const brainApi = {
  models: () => api.get("/api/brain/models"),

  getSettings: () => api.get("/api/brain/settings"),

  saveSettings: (enrich_model: string | null, answer_model: string | null) =>
    api.put("/api/brain/settings", { enrich_model, answer_model }),

  config: () => api.get("/api/brain/config"),

  upload: (file: File, opts?: { workspace?: string; folder?: string }) => {
    const fd = new FormData();
    fd.append("file", file);
    if (opts?.workspace) fd.append("workspace", opts.workspace);
    if (opts?.folder) fd.append("folder", opts.folder);
    return api.post("/api/brain/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  ingestUrl: (url: string, opts?: { workspace?: string; folder?: string }) =>
    api.post("/api/brain/ingest-url", { url, ...opts }),

  documents: (opts?: { workspace?: string; folder?: string }) =>
    api.get("/api/brain/documents", { params: opts }),

  document: (docId: string) => api.get(`/api/brain/document/${docId}`),

  remove: (docId: string) => api.delete(`/api/brain/document/${docId}`),

  folders: (workspace?: string) =>
    api.get("/api/brain/folders", { params: { workspace } }),

  ask: (question: string, opts?: { workspace?: string; folder?: string; conversation_id?: string }) =>
    api.post("/api/brain/ask", { question, ...opts }),

  listConversations: (workspace?: string) =>
    api.get("/api/brain/conversations", { params: { workspace } }),

  newConversation: (workspace?: string, title?: string) =>
    api.post("/api/brain/conversations", { workspace, title }),

  getConversation: (id: string) => api.get(`/api/brain/conversation/${id}`),

  deleteConversation: (id: string) => api.delete(`/api/brain/conversation/${id}`),

  renameConversation: (id: string, title: string) =>
    api.patch(`/api/brain/conversation/${id}`, { title }),


  connectorTypes: () => api.get("/api/brain/connectors/types"),

  listConnectors: (workspace?: string) =>
    api.get("/api/brain/connectors", { params: { workspace } }),

  addConnector: (connector_type: string, name: string, config: Record<string, string>, workspace?: string) =>
    api.post("/api/brain/connectors", { connector_type, name, config, workspace }),

  validateConnector: (id: string) => api.post(`/api/brain/connectors/${id}/validate`, {}),

  setConnectorEnabled: (id: string, enabled: boolean) =>
    api.patch(`/api/brain/connectors/${id}`, { enabled }),

  deleteConnector: (id: string) => api.delete(`/api/brain/connectors/${id}`),

  syncConnector: (id: string) => api.post(`/api/brain/connectors/${id}/sync`, {}),

  dashboard: (workspace?: string) =>
    api.get("/api/brain/dashboard", { params: { workspace } }),
};
