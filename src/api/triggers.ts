import { api } from "./client";

export interface Trigger {
  trigger_id:             string;
  name:                   string;
  type:                   string;   // "manual" | "gmail" | "schedule" | "webhook"
  config:                 Record<string, any>;
  target_orchestrator_id: string;
  router_agent_id?:       string;
  prompt_template?:       string;
  status?:                string;   // "ACTIVE" | "PAUSED"
  is_active?:             boolean;
  last_fired_at?:         string;
  last_status?:           string;   // "OK" | "ERROR" | "SKIPPED"
  created_at:             string;
}

export interface TestFireResult {
  session_id:      string;
  conversation_id: string;
  status:          string;
}

export const triggersApi = {
  list: () =>
    api.get<Trigger[]>("/api/triggers/"),

  create: (
    name:                   string,
    type:                   string,
    config:                 Record<string, any>,
    target_orchestrator_id: string,
    router_agent_id?:       string,
    prompt_template?:       string,
  ) =>
    api.post<Trigger>("/api/triggers/", {
      name, type, config, target_orchestrator_id,
      router_agent_id, prompt_template,
    }),

  update: (
    id:                     string,
    name:                   string,
    type:                   string,
    config:                 Record<string, any>,
    target_orchestrator_id: string,
    router_agent_id?:       string,
    prompt_template?:       string,
    status?:                string,
  ) =>
    api.put(`/api/triggers/${id}`, {
      name, type, config, target_orchestrator_id,
      router_agent_id, prompt_template, status,
    }),

  delete: (id: string) =>
    api.delete(`/api/triggers/${id}`),

  pause: (id: string) =>
    api.post(`/api/triggers/${id}/pause`, {}),

  resume: (id: string) =>
    api.post(`/api/triggers/${id}/resume`, {}),

  testFire: (id: string, override_prompt?: string) =>
    api.post<TestFireResult>(`/api/triggers/${id}/test-fire`, { override_prompt }),
};
