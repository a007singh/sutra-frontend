/**
 * approvalQueue.ts — Phase 2.5b (approver queue)
 * ==============================================
 * Read-only client for the pending-approval queue. Does NOT touch the approval
 * mechanism — approvals are still consumed via the existing chat / email flow.
 *
 * Place at: frontend/src/api/approvalQueue.ts
 */

import { api } from "./client";

export interface QueueItem {
  session_id: string;
  conversation_id: string;
  orchestrator_id: string;
  human_question: string | null;
  prompt: string | null;
  start_time: string | null;
}

export const approvalQueueApi = {
  pending: () => api.get("/api/executions/queue/pending"),
};
