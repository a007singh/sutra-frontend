import { api } from "./client";

export interface Workflow {
  workflow_id: string;
  name: string;
  description: string;
  created_at: string;
}

export const workflowsApi = {
  list: () => api.get<Workflow[]>("/api/workflows/"),
  create: (name: string, desc: string) =>
    api.post("/api/workflows/", { name, description: desc }),
  update: (id: string, name: string, desc: string) =>
    api.put(`/api/workflows/${id}`, { name, description: desc }),
  delete: (id: string) => api.delete(`/api/workflows/${id}`),
};