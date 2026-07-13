import { api } from "./client";

export interface Orchestrator {
  orchestrator_agent_id: string;
  name: string;
  workflow_id: string;
  model_id: string;
  system_prompt: string;
  sub_agents: string[];
  created_at: string;
}

export const orchestratorsApi = {
  list: () => api.get<Orchestrator[]>("/api/orchestrators/"),
  create: (name: string, workflow_id: string, model_id: string, system_prompt: string, sub_agent_ids: string[]) =>
    api.post("/api/orchestrators/", { name, workflow_id, model_id, system_prompt, sub_agent_ids }),
  update: (id: string, name: string, workflow_id: string, model_id: string, system_prompt: string, sub_agent_ids: string[]) =>
    api.put(`/api/orchestrators/${id}`, { name, workflow_id, model_id, system_prompt, sub_agent_ids }),
  delete: (id: string) => api.delete(`/api/orchestrators/${id}`),
  stats: (id: string) => api.get(`/api/orchestrators/${id}/stats`),
  exportConfig: (id: string) =>
    api.get(`/api/orchestrators/${id}/export`),
  importConfig: (config: object, mode: "create" | "update", orchestrator_id?: string) =>
    api.post("/api/orchestrators/import", { config, mode, orchestrator_id }),
};