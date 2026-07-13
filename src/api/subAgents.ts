import { api } from "./client";

export interface SubAgent {
  sub_agent_id: string;
  sub_agent_name: string;
  model_name: string;
  system_prompt: string;
  mcp_servers: string;
  created_at: string;
}

export const subAgentsApi = {
  list: () => api.get<SubAgent[]>("/api/sub-agents/"),
  create: (name: string, model_name: string, system_prompt: string, mcp_servers: string) =>
    api.post("/api/sub-agents/", { name, model_name, system_prompt, mcp_servers }),
  update: (id: string, name: string, model_name: string, system_prompt: string, mcp_servers: string) =>
    api.put(`/api/sub-agents/${id}`, { name, model_name, system_prompt, mcp_servers }),
  delete: (id: string) => api.delete(`/api/sub-agents/${id}`),
  testMcp: (mcp_servers: string) =>
    api.post("/api/sub-agents/test-mcp", { mcp_servers: JSON.parse(mcp_servers) }),
  createFromTemplate: (
    name: string,
    model_name: string,
    system_prompt: string,
    mcp_servers: string
  ) => api.post("/api/sub-agents/", { name, model_name, system_prompt, mcp_servers }),
};