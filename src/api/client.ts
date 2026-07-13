import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8009",
});

// Add JWT token to every request (Cognito token goes here in Phase 4+)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("id_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const AVAILABLE_MODELS = [
  { id: "us.anthropic.claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "anthropic.claude-sonnet-4-5-20251001-v1:0", label: "Claude Sonnet 4.5" },
  { id: "anthropic.claude-3-5-sonnet-20241022-v2:0", label: "Claude 3.5 Sonnet v2" },
  { id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",  label: "Claude 3.5 Haikuu" },
  { id: "anthropic.claude-3-opus-20240229-v1:0",      label: "Claude 3 Opus" },
  { id: "us.amazon.nova-pro-v1:0",                    label: "Amazon Nova Pro" },
  { id: "us.amazon.nova-lite-v1:0",                      label: "Amazon Nova Lite" },
  { id: "us.amazon.nova-micro-v1:0",                     label: "Amazon Nova Micro" },
  { id: "meta.llama3-70b-instruct-v1:0",              label: "Meta Llama 3 70B" },
  { id: "mistral.mistral-large-2402-v1:0",            label: "Mistral Large" },
];