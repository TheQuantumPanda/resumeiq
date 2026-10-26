import { afterEach, describe, expect, it, vi } from "vitest";
import { usePuterStore } from "./puter";
import { buildFeedbackMessages } from "./feedback.schema";

afterEach(() => vi.unstubAllGlobals());

describe("Puter text review request", () => {
  it("sends extracted text with Sonnet 4.5, a 4096-token cap and cancellation without attachments or retries", async () => {
    const chat = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("window", { puter: { ai: { chat } } });
    const controller = new AbortController();
    const messages = buildFeedbackMessages({
      resumeText: "Fictional candidate built a React and SQL project.",
      jobTitle: "Developer",
      jobDescription: "Build React interfaces.",
    });
    await usePuterStore
      .getState()
      .ai.feedback(
        messages,
        controller.signal,
      );
    expect(chat).toHaveBeenCalledTimes(1);
    expect(chat).toHaveBeenCalledWith(
      messages,
      {
        model: "claude-sonnet-4.5",
        stream: false,
        max_tokens: 4096,
        signal: controller.signal,
      },
    );
    expect(messages.every(({ content }) => typeof content === "string")).toBe(true);
    expect(JSON.stringify(chat.mock.calls)).not.toContain("puter_path");
    expect(JSON.parse(messages[1].content as string).resume_text)
      .toBe("Fictional candidate built a React and SQL project.");
  });
});
