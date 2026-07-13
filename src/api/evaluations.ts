import { api } from "./client";

export interface ExpectedBehaviour {
  output_contains?:     string[];
  output_not_contains?: string[];
  tools_called?:        string[];
  hitl_triggered?:      boolean | null;
  completed?:           boolean;
}

export interface TestCase {
  test_case_id?:       string;
  name:                string;
  input_prompt:        string;
  expected:            ExpectedBehaviour;
  scoring_method:      "deterministic" | "llm_judge";
  judge_prompt:        string;
  hitl_auto_response:  string;
}

export interface EvalTestResult {
  test_case_id:   string;
  test_case_name: string;
  session_id:     string | null;
  status:         "PASS" | "FAIL" | "PARTIAL";
  score:          number;
  reason:         string;
  output_preview: string;
  hitl_fired:     boolean;
  exec_status:    string;
  duration_ms:    number;
}

export interface EvalRun {
  eval_run_id:     string;
  orchestrator_id: string;
  status:          "RUNNING" | "COMPLETED" | "FAILED";
  results:         EvalTestResult[];
  score:           number | null;
  pass_count:      number;
  fail_count:      number;
  regression:      boolean;
  created_at:      string;
  completed_at?:   string;
}

export const evaluationsApi = {
  getSuite: (orchId: string) =>
    api.get<{ orchestrator_id: string; test_cases: TestCase[] }>(
      `/api/evaluations/${orchId}/suite`
    ),

  saveSuite: (orchId: string, testCases: TestCase[]) =>
    api.put(`/api/evaluations/${orchId}/suite`, { test_cases: testCases }),

  addTestCase: (orchId: string, tc: Omit<TestCase, "test_case_id">) =>
    api.post<{ added: boolean; test_case_id: string }>(
      `/api/evaluations/${orchId}/suite/test-case`, tc
    ),

  deleteTestCase: (orchId: string, tcId: string) =>
    api.delete(`/api/evaluations/${orchId}/suite/test-case/${tcId}`),

  runEvaluation: (orchId: string) =>
    api.post<{ eval_run_id: string; status: string; test_case_count: number }>(
      `/api/evaluations/${orchId}/run`, {}
    ),

  listRuns: (orchId: string) =>
    api.get<EvalRun[]>(`/api/evaluations/${orchId}/runs`),

  getRun: (runId: string) =>
    api.get<EvalRun>(`/api/evaluations/runs/${runId}`),
};
