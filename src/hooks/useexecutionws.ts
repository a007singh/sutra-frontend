import { useEffect, useRef, useState, useCallback } from "react";

export interface WSEvent {
  type: "log" | "hitl_question" | "status" | "ping" | "usage";
  line?: string;
  question?: string;
  status?: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost_usd?: number;
}

export function useExecutionWS(sessionId: string | null) {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [hitlQuestion, setHitlQuestion] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Reset events for every new session
    setEvents([]);
    setHitlQuestion(null);

    if (!sessionId) return;

    // Derive the WebSocket URL from the same backend base URL as the REST API.
    // Converts http->ws and https->wss so it works both locally (http/ws) and in
    // production (https/wss). Browsers block insecure ws:// from an https:// page,
    // so the wss:// upgrade is required in production.
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8009";
    const wsBase = apiBase.replace(/^http/, "ws"); // http->ws, https->wss
    const ws = new WebSocket(`${wsBase}/ws/executions/${sessionId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const evt: WSEvent = JSON.parse(e.data);
      if (evt.type === "ping") return;
      // Append one event at a time — avoids batching race condition
      setEvents(prev => [...prev, evt]);
      if (evt.type === "hitl_question") setHitlQuestion(evt.question!);
      if (evt.type === "status") setHitlQuestion(null);
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [sessionId]);

  return { events, hitlQuestion, setHitlQuestion };
}