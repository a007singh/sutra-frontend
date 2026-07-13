import { api } from "./client";

export interface ExecutionRecord {
  session_id: string;
  orchestrator_id: string;
  orchestrator_name: string;
  trigger_id: string;
  status: string;
  start_time: string;
  end_time?: string;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd?: string;
  logs?: string[];
  prompt?: string;
}

export const executionsApi = {
  list:       ()                                         => api.get("/api/executions/"),
  get:        (session_id: string)                       => api.get<ExecutionRecord>(`/api/executions/${session_id}`),
  trigger:    (orchestrator_id: string, trigger_id: string, prompt: string) =>
    api.post("/api/executions/", { orchestrator_id, trigger_id, prompt }),
  submitHitl: (session_id: string, answer: string)       =>
    api.post(`/api/executions/${session_id}/hitl-answer`, { answer }),
  cancel:     (session_id: string)                       =>
    api.post(`/api/executions/${session_id}/cancel`),
  stats: ()                                              => api.get("/api/executions/stats/summary"),
  history: (orchestrator_id?: string)                    =>
    api.get<ExecutionRecord[]>("/api/executions/history",
      orchestrator_id ? { params: { orchestrator_id } } : {}
    ),
  usage: (period: number) => api.get(`/api/executions/stats/usage?period=${period}`),
  agentPerformance: (period: number) => api.get(`/api/executions/stats/agent-performance?period=${period}`),
};
