import { describe, expect, it } from "vitest";
import { scrubAiLogExtra } from "@/lib/ai/jobs/log";

describe("scrubAiLogExtra", () => {
  it("redacts secrets and omits prompt-like fields", () => {
    const scrubbed = scrubAiLogExtra({
      jobId: "job-1",
      OPENAI_API_KEY: "sk-secret",
      authorization: "Bearer x",
      messages: [{ role: "user", content: "履歴全文" }],
      prompt: "full prompt",
      content: "user text",
      body: { input: "raw" },
      rawResponse: { output_text: "..." },
      text: "assistant reply",
      latencyMs: 42,
      errorCode: "provider_aborted",
    });
    expect(scrubbed).toEqual({
      jobId: "job-1",
      OPENAI_API_KEY: "[redacted]",
      authorization: "[redacted]",
      messages: "[omitted]",
      prompt: "[omitted]",
      content: "[omitted]",
      body: "[omitted]",
      rawResponse: "[omitted]",
      text: "[omitted]",
      latencyMs: 42,
      errorCode: "provider_aborted",
    });
  });

  it("truncates long free-form strings", () => {
    const long = "あ".repeat(600);
    const scrubbed = scrubAiLogExtra({ errorMessage: long });
    expect(String(scrubbed?.errorMessage)).toContain("[truncated 600]");
    expect(String(scrubbed?.errorMessage).length).toBeLessThan(120);
  });
});
