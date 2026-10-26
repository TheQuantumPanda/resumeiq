import { describe, expect, it, vi } from "vitest";
import {
  analyzeWithPuter,
  extractJson,
  readMessageText,
  providerError,
} from "./analyzePuter";
import { MAX_AI_RESUME_TEXT_LENGTH } from "./validation";

const tip = {
  type: "good" as const,
  tip: "Strong verbs",
  explanation: "Bullets open with action verbs.",
};
const category = { score: 80, tips: [tip] };
const feedbackJson = {
  overallScore: 82,
  ATS: { score: 75, tips: [{ type: "improve" as const, tip: "Add keywords" }] },
  toneAndStyle: category,
  content: category,
  structure: category,
  skills: category,
};

const reply = (content: string | unknown[]) =>
  ({ message: { content } }) as AIResponse;

type FeedbackFn = (
  messages: ChatMessage[],
  signal?: AbortSignal,
) => Promise<AIResponse | undefined>;
const feedbackMock = () => vi.fn<FeedbackFn>();

describe("extractJson", () => {
  const json = '{"a":1}';

  it("reads a bare JSON body", () => {
    expect(extractJson(json)).toEqual({ a: 1 });
  });

  it("strips a json-tagged markdown fence", () => {
    expect(extractJson("```json\n" + json + "\n```")).toEqual({ a: 1 });
  });

  it("strips a plain markdown fence and surrounding whitespace", () => {
    expect(extractJson("\n\n```\n" + json + "\n```\n\n")).toEqual({ a: 1 });
  });

  it("throws on content that is not JSON at all", () => {
    expect(() => extractJson("I cannot help with that.")).toThrow();
  });
});

describe("readMessageText", () => {
  it("reads string content", () => {
    expect(readMessageText(reply("hello"))).toBe("hello");
  });

  it("reads the first block of array content", () => {
    expect(readMessageText(reply([{ text: "hello" }]))).toBe("hello");
  });

  it("throws when there is no text to read", () => {
    expect(() => readMessageText(reply([]))).toThrow("empty response");
  });
});

describe("analyzeWithPuter", () => {
  const call = (feedback: ReturnType<typeof feedbackMock>) =>
    analyzeWithPuter({
      resumeText: "Fictional candidate built a SQL reporting project.",
      jobTitle: "Analyst",
      jobDescription: "SQL",
      feedback,
    });

  it.each(["", " \n\t ", "---", "x".repeat(MAX_AI_RESUME_TEXT_LENGTH + 1)])(
    "rejects unusable or oversized text before invoking the provider (%#)",
    async (resumeText) => {
      const feedback = feedbackMock();
      await expect(analyzeWithPuter({ resumeText, jobTitle: "Developer", jobDescription: "React", feedback }))
        .rejects.toThrow(/No usable resume text|30,000-character AI limit/);
      expect(feedback).not.toHaveBeenCalled();
    },
  );

  it("forwards all text at the size limit without truncating it", async () => {
    const resumeText = "a".repeat(MAX_AI_RESUME_TEXT_LENGTH - 4) + " END";
    const feedback = feedbackMock().mockResolvedValue(reply(JSON.stringify(feedbackJson)));
    await analyzeWithPuter({ resumeText, jobTitle: "Developer", jobDescription: "React", feedback });
    expect(JSON.parse(feedback.mock.calls[0][0][1].content as string).resume_text).toBe(resumeText);
  });

  it("rejects a schema-valid missing-document response instead of accepting an all-zero score", async () => {
    const missing = { score: 0, tips: [{ ...tip, explanation: "No resume file was successfully uploaded." }] };
    const feedback = feedbackMock().mockResolvedValue(reply(JSON.stringify({
      ...feedbackJson, overallScore: 0,
      toneAndStyle: missing, content: missing, structure: missing, skills: missing,
    })));
    await expect(call(feedback)).rejects.toThrow("AI could not evaluate the resume content");
    expect(feedback).toHaveBeenCalledTimes(1);
  });

  it("accepts valid zero scores without fabricating a positive score", async () => {
    const zero = { ...category, score: 0 };
    const feedback = feedbackMock().mockResolvedValue(reply(JSON.stringify({
      ...feedbackJson, overallScore: 0, ATS: { ...feedbackJson.ATS, score: 0 },
      toneAndStyle: zero, content: zero, structure: zero, skills: zero,
    })));
    expect((await call(feedback)).overallScore).toBe(0);
  });

  it("returns schema-valid feedback from a fenced reply", async () => {
    const feedback = feedbackMock().mockResolvedValue(
      reply("```json\n" + JSON.stringify(feedbackJson) + "\n```"),
    );

    await expect(call(feedback)).resolves.toEqual({
      ...feedbackJson,
      overallScore: 80,
    });
    expect(feedback).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ role: "user", content: expect.stringContaining("Analyst") })]),
      expect.any(AbortSignal),
    );
  });

  it.each([3, 4])("accepts concise feedback with %i suggestions per category", async (count) => {
    const conciseTip = {
      type: "improve" as const,
      tip: "Clarify your documented project contribution",
      explanation:
        "Describe your existing contribution to the React project using its original facts. If an outcome is undocumented, ask the candidate to verify it before adding any numerical claim.",
    };
    const tips = Array.from({ length: count }, () => ({ ...conciseTip }));
    const concise = {
      ...feedbackJson,
      ATS: {
        score: 75,
        tips: tips.map(({ type, tip }) => ({ type, tip })),
      },
      toneAndStyle: { score: 41, tips },
      content: { score: 82, tips },
      structure: { score: 69, tips },
      skills: { score: 70, tips },
    };
    const feedback = feedbackMock().mockResolvedValue({
      ...reply(JSON.stringify(concise)),
      finish_reason: "stop",
    });

    await expect(call(feedback)).resolves.toEqual({ ...concise, overallScore: 66 });
    expect(feedback).toHaveBeenCalledTimes(1);
  });

  it.each(["length", "max_tokens"])(
    "rejects output marked %s even when its JSON is complete and schema-valid",
    async (finishReason) => {
      const feedback = feedbackMock().mockResolvedValue({
        ...reply(JSON.stringify(feedbackJson)),
        finish_reason: finishReason,
      });

      await expect(call(feedback)).rejects.toThrow("did not complete the review");
      expect(feedback).toHaveBeenCalledTimes(1);
    },
  );

  it.each([undefined, "stop"])(
    "rejects cut-off JSON even without a token-limit finish marker (%s)",
    async (finishReason) => {
      const feedback = feedbackMock().mockResolvedValue({
        ...reply(JSON.stringify(feedbackJson).slice(0, -1)),
        finish_reason: finishReason,
      } as AIResponse);

      await expect(call(feedback)).rejects.toThrow("malformed JSON");
      expect(feedback).toHaveBeenCalledTimes(1);
    },
  );

  it.each([0, 100])(
    "averages only the four writing categories, excluding readability %i and the model total",
    async (readability) => {
      const feedback = feedbackMock().mockResolvedValue(
        reply(
          JSON.stringify({
            ...feedbackJson,
            overallScore: 99,
            ATS: { ...feedbackJson.ATS, score: readability },
            toneAndStyle: { ...category, score: 41 },
            content: { ...category, score: 82 },
            structure: { ...category, score: 69 },
            skills: { ...category, score: 70 },
          }),
        ),
      );
      // (41 + 82 + 69 + 70) / 4 = 65.5, rounded to 66.
      expect((await call(feedback)).overallScore).toBe(66);
    },
  );

  it("sends the JSON schema in the prompt", async () => {
    const feedback = feedbackMock().mockResolvedValue(
      reply(JSON.stringify(feedbackJson)),
    );
    await call(feedback);

    expect(feedback.mock.calls[0][0][0].content).toContain("overallScore");
  });

  it("rejects a reply that does not match the schema", async () => {
    const feedback = feedbackMock().mockResolvedValue(
      reply(JSON.stringify({ ...feedbackJson, overallScore: 500 })),
    );

    await expect(call(feedback)).rejects.toThrow("unexpected shape");
  });

  it("reports an unavailable Puter AI", async () => {
    const feedback = feedbackMock().mockResolvedValue(undefined);

    await expect(call(feedback)).rejects.toThrow("unavailable");
  });
});

describe("provider failures", () => {
  const call = (feedback: FeedbackFn, timeoutMs = 1000) =>
    analyzeWithPuter({
      resumeText: "Fictional candidate built React interfaces.",
      jobTitle: "Developer",
      jobDescription: "React",
      feedback,
      timeoutMs,
    });
  it("handles plain-object authentication and quota failures without echoing personal data", async () => {
    await expect(
      call(
        vi.fn().mockRejectedValue({
          code: "unauthorized",
          message: "private candidate data",
        }),
      ),
    ).rejects.toThrow("Sign in again");
    await expect(
      call(vi.fn().mockRejectedValue({ status: 429 })),
    ).rejects.toThrow("limit");
    await expect(
      call(vi.fn().mockRejectedValue({ message: "private candidate data" })),
    ).rejects.not.toThrow("private candidate data");
  });
  it("rejects malformed JSON and incomplete replies", async () => {
    await expect(
      call(vi.fn().mockResolvedValue(reply("invalid json"))),
    ).rejects.toThrow("malformed JSON");
    await expect(
      call(
        vi.fn().mockResolvedValue({
          ...reply(JSON.stringify(feedbackJson)),
          finish_reason: "length",
        }),
      ),
    ).rejects.toThrow("did not complete");
  });
  it("times out without silently retrying a billable request", async () => {
    vi.useFakeTimers();
    try {
      const feedback = vi
        .fn<FeedbackFn>()
        .mockImplementation(() => new Promise(() => {}));
      const pending = call(feedback);
      const assertion = expect(pending).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
      expect(feedback).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it("joins text blocks, ignoring thinking blocks", () => {
    expect(
      readMessageText(
        reply([
          { type: "thinking", text: "hidden" },
          { type: "text", text: "one" },
          { type: "text", text: "two" },
        ]),
      ),
    ).toBe("onetwo");
  });
});

describe("safe Puter error classification", () => {
  it.each([
    ["model_not_found", "configured AI model is unavailable"],
    [
      { error: { code: "unknown_model" } },
      "configured AI model is unavailable",
    ],
    [
      { error: "Model claude-example does not exist" },
      "configured AI model is unavailable",
    ],
    [{ error: { code: "insufficient_funds" } }, "allowance or credits"],
    [{ status: 402 }, "allowance or credits"],
    [{ error: { code: "subscription_required" } }, "allowance or credits"],
    [{ error: { code: "email_must_be_confirmed" } }, "email verification"],
    [{ error: { code: "auth_canceled" } }, "Sign in again"],
    [{ error: { code: "rate_limit_exceeded" } }, "rate limit"],
    [{ error: { errorCode: "credits_reserved" } }, "rate limit"],
    [{ error: { code: "request_timeout" } }, "timed out"],
    [{ status: 504 }, "timed out"],
    [{ name: "AbortError" }, "request was cancelled"],
    [
      {
        code: "context_length_exceeded",
        message: "Input is over the token limit",
      },
      "input size",
    ],
    [{ error: { code: "unsupported_file" } }, "attached PDF"],
    [{ error: { status: 400 } }, "rejected the review request"],
    [{ error: { statusCode: 503 } }, "temporarily unavailable"],
    [{ code: "invalid_response" }, "invalid provider response"],
    [{ name: "SyntaxError" }, "invalid provider response"],
    [{ code: "network_error" }, "could not reach the service"],
    [{ status: 0 }, "could not reach the service"],
  ])(
    "classifies a provider failure using fixed safe text (%j)",
    (error, expected) => {
      expect(providerError(error)).toContain(expected);
    },
  );

  it("handles a cyclic nested error without echoing tokens, paths or resume text", () => {
    const error: { error?: unknown; message: string; token: string } = {
      message:
        "Fictional private resume /fictional-private.pdf secret-session-value",
      token: "secret-session-value",
    };
    error.error = error;
    const message = providerError(error);
    expect(message).toContain("reason could not be classified safely");
    expect(message).not.toContain("Fictional private");
    expect(message).not.toContain("secret-session-value");
    expect(message).not.toContain("fictional-private.pdf");
  });
});

describe("request-stage failures and abort races", () => {
  it("reports a rejected request before trying to parse feedback, with exactly one provider call", async () => {
    const feedback = vi.fn().mockRejectedValue({
      error: {
        code: "model_not_found",
        message: "Fictional sensitive request contents",
      },
    });
    await expect(
      analyzeWithPuter({
        resumeText: "Fictional candidate built React interfaces.",
        jobTitle: "Developer",
        jobDescription: "React",
        feedback,
      }),
    ).rejects.toThrow("configured AI model is unavailable");
    expect(feedback).toHaveBeenCalledTimes(1);
  });

  it("keeps timeout classification when aborting the SDK rejects before the timer's own rejection", async () => {
    vi.useFakeTimers();
    try {
      const feedback = vi.fn<FeedbackFn>().mockImplementation(
        (_messages, signal) =>
          new Promise<AIResponse | undefined>((_resolve, reject) => {
            signal?.addEventListener(
              "abort",
              () =>
                reject(new DOMException("Fictional SDK abort", "AbortError")),
              { once: true },
            );
          }),
      );
      const pending = analyzeWithPuter({
        resumeText: "Fictional candidate built React interfaces.",
        jobTitle: "Developer",
        jobDescription: "React",
        feedback,
        timeoutMs: 1000,
      });
      const assertion = expect(pending).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(1001);
      await assertion;
      expect(feedback).toHaveBeenCalledTimes(1);
      expect(feedback.mock.calls[0][1]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("AI deadline boundaries", () => {
  const input = {
    resumeText: "Fictional candidate built React interfaces.",
    jobTitle: "Developer",
    jobDescription: "React",
  };

  it("leaves a pending SDK call alone until the default 90-second deadline, then aborts once", async () => {
    vi.useFakeTimers();
    try {
      const feedback = vi.fn<FeedbackFn>(() => new Promise(() => {}));
      const pending = analyzeWithPuter({ ...input, feedback });
      const assertion = expect(pending).rejects.toThrow("timed out");
      const signal = feedback.mock.calls[0][1]!;
      const onAbort = vi.fn();
      signal.addEventListener("abort", onAbort);

      await vi.advanceTimersByTimeAsync(89999);
      expect(signal.aborted).toBe(false);
      expect(onAbort).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await assertion;
      expect(signal.aborted).toBe(true);
      expect(onAbort).toHaveBeenCalledTimes(1);
      expect(feedback).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([{ code: "request_timeout" }, { status: 504 }])(
    "can report the same timeout text before the app deadline without aborting (%j)",
    async (providerFailure) => {
      vi.useFakeTimers();
      try {
        const feedback = vi.fn<FeedbackFn>(
          () => new Promise((_resolve, reject) => {
            setTimeout(() => reject(providerFailure), 5000);
          }),
        );
        const pending = analyzeWithPuter({ ...input, feedback });
        const assertion = expect(pending).rejects.toThrow("timed out");
        await vi.advanceTimersByTimeAsync(5000);
        await assertion;
        expect(feedback.mock.calls[0][1]?.aborted).toBe(false);
        expect(feedback).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("clears the deadline after success so a completed request is never aborted later", async () => {
    vi.useFakeTimers();
    try {
      const feedback = vi.fn<FeedbackFn>(
        () => new Promise((resolve) => {
          setTimeout(() => resolve(reply(JSON.stringify(feedbackJson))), 1000);
        }),
      );
      const pending = analyzeWithPuter({ ...input, feedback });
      await vi.advanceTimersByTimeAsync(1000);
      await expect(pending).resolves.toMatchObject({ overallScore: 80 });
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(90000);
      expect(feedback.mock.calls[0][1]?.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not parse a late SDK reply after timing out even if the SDK ignores cancellation", async () => {
    vi.useFakeTimers();
    try {
      const readContent = vi.fn(() => JSON.stringify(feedbackJson));
      const lateReply = { message: { get content() { return readContent(); } } };
      const feedback = vi.fn<FeedbackFn>(
        () => new Promise((resolve) => {
          setTimeout(() => resolve(lateReply as AIResponse), 91000);
        }),
      );
      const pending = analyzeWithPuter({ ...input, feedback });
      const assertion = expect(pending).rejects.toThrow("timed out");
      await vi.advanceTimersByTimeAsync(90000);
      await assertion;
      await vi.advanceTimersByTimeAsync(1000);
      expect(readContent).not.toHaveBeenCalled();
      expect(feedback).toHaveBeenCalledTimes(1);
      expect(feedback.mock.calls[0][1]?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
