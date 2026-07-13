import { api } from "./client";

export interface ModelPricing {
  input: number;
  output: number;
}

export interface Settings {
  default_model: string;
  aws_region: string;
  bedrock_endpoint: string;
  agentcore_runtime_arn?: string;
  pricing: Record<string, ModelPricing>;
}

export const settingsApi = {
  get:  ()                => api.get<Settings>("/api/settings/"),
  save: (data: Settings)  => api.put("/api/settings/", data),
};