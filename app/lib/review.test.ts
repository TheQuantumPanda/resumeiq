import { describe, expect, it, vi } from "vitest";
import { prepareSavedReview, runReview } from "./review";
import { matchJob } from "./matching";
import { MAX_AI_RESUME_TEXT_LENGTH } from "./validation";

const jobDescription =
  "Build React interfaces with TypeScript and SQL. Write unit tests and collaborate with designers.";
const record: Resume = {
  id: "fictional",
  resumePath: "/fictional.pdf",
  imagePath: "/preview.png",
  jobDescription: "Old description",
  feedback: { overallScore: 99 } as Feedback,
};
const category = {
  score: 72,
  tips: [
    {
      type: "improve",
      tip: "Be specific",
      explanation:
        "Describe the existing project more clearly without inventing impact.",
    },
  ],
};
const response = {
  message: {
    content: JSON.stringify({
      overallScore: 90,
      ATS: { score: 60, tips: [{ type: "good", tip: "Text is readable" }] },
      toneAndStyle: category,
      content: category,
      structure: category,
      skills: category,
    }),
  },
} as AIResponse;

describe("saved review lifecycle", () => {
  it("recomputes from the supplied resume and description, clearing old AI feedback before calling AI", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const feedback = vi.fn().mockImplementation(async () => {
      const pending = JSON.parse(save.mock.calls[0][1]);
      expect(pending.jobDescription).toBe(jobDescription);
      expect(pending.feedback).toBeUndefined();
      expect(pending.match.matched).toEqual(["react"]);
      expect(pending.status).toBe("analyzing");
      return response;
    });
    const result = await runReview({
      record,
      resumeText: "React project",
      jobDescription,
      feedback,
      save,
    });
    expect(result.status).toBe("ready");
    expect(result.feedback?.overallScore).toBe(72);
    expect(save).toHaveBeenCalledTimes(2);
    expect(record.jobDescription).toBe("Old description");
    const sent = JSON.parse(feedback.mock.calls[0][0][1].content);
    expect(sent.resume_text).toBe("React project");
    expect(sent.job_description).toBe(jobDescription);
  });
  it("preserves matching when AI fails and allows a successful manual retry", async () => {
    const save = vi.fn().mockResolvedValue(true);
    const feedback = vi
      .fn()
      .mockRejectedValueOnce({ code: "quota_exceeded" })
      .mockResolvedValueOnce(response);
    const failed = await runReview({
      record,
      resumeText: "React",
      jobDescription,
      feedback,
      save,
    });
    expect(failed.status).toBe("failed");
    expect(failed.error).toContain("allowance or credits");
    expect(failed.match?.score).toBeGreaterThan(0);
    expect(failed.feedback).toBeUndefined();
    const ready = await runReview({
      record: failed,
      resumeText: "React",
      jobDescription,
      feedback,
      save,
    });
    expect(ready.status).toBe("ready");
    expect(ready.error).toBeUndefined();
    expect(feedback).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(4);
  });

  it("retains matching after missing-document feedback and recovers on an explicit rerun with fresh text", async () => {
    const missing = {
      ...response,
      message: { ...response.message, content: JSON.stringify({
        ...JSON.parse(response.message.content as string),
        ATS: { score: 0, tips: [{ type: "improve", tip: "No resume file was successfully uploaded." }] },
      }) },
    };
    const save = vi.fn().mockResolvedValue(true);
    const feedback = vi.fn().mockResolvedValueOnce(missing).mockResolvedValueOnce(response);
    const failed = await runReview({ record, resumeText: "React", jobDescription, feedback, save });
    expect(failed.status).toBe("failed");
    expect(failed.feedback).toBeUndefined();
    expect(failed.match).toEqual(matchJob("React", jobDescription));
    expect(feedback).toHaveBeenCalledTimes(1);
    const ready = await runReview({ record: failed, resumeText: "React and SQL", jobDescription, feedback, save });
    expect(ready.status).toBe("ready");
    expect(ready.error).toBeUndefined();
    expect(ready.feedback?.overallScore).toBe(72);
    expect(ready.match).toEqual(matchJob("React and SQL", jobDescription));
    expect(JSON.parse(feedback.mock.calls[1][0][1].content).resume_text).toBe("React and SQL");
    expect(feedback).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(4);
  });

  it("keeps an existing keyword result when empty input cannot be analyzed", async () => {
    const existing = { ...record, match: matchJob("React", jobDescription) };
    const feedback = vi.fn();
    const result = await runReview({ record: existing, resumeText: " \n", jobDescription, feedback, save: vi.fn().mockResolvedValue(true) });
    expect(result.status).toBe("failed");
    expect(result.match).toEqual(existing.match);
    expect(result.feedback).toBeUndefined();
    expect(feedback).not.toHaveBeenCalled();
  });

  it("preserves matching for oversized text but makes no AI request", async () => {
    const resumeText = "React " + "x".repeat(MAX_AI_RESUME_TEXT_LENGTH);
    const feedback = vi.fn();
    const result = await runReview({ record, resumeText, jobDescription, feedback, save: vi.fn().mockResolvedValue(true) });
    expect(result.status).toBe("failed");
    expect(result.match).toEqual(matchJob(resumeText, jobDescription));
    expect(result.error).toContain("no content was truncated");
    expect(result.feedback).toBeUndefined();
    expect(feedback).not.toHaveBeenCalled();
  });
  it.each([
    {
      reason: "length",
      reply: { ...response, finish_reason: "length" },
      error: "did not complete the review",
    },
    {
      reason: "max_tokens",
      reply: { ...response, finish_reason: "max_tokens" },
      error: "did not complete the review",
    },
    {
      reason: "schema validation",
      reply: {
        ...response,
        message: { ...response.message, content: '{"overallScore":75}' },
      },
      error: "unexpected shape",
    },
  ])("preserves the saved keyword match after $reason failure without retrying", async ({ reply, error }) => {
    const save = vi.fn().mockResolvedValue(true);
    const feedback = vi.fn().mockResolvedValue(reply);
    const result = await runReview({
      record,
      resumeText: "React",
      jobDescription,
      feedback,
      save,
    });
    const pending = JSON.parse(save.mock.calls[0][1]) as Resume;
    const persisted = JSON.parse(save.mock.calls[1][1]) as Resume;

    expect(result.status).toBe("failed");
    expect(result.error).toContain(error);
    expect(result.feedback).toBeUndefined();
    expect(result.match).toEqual(pending.match);
    expect(result.match?.score).toBeGreaterThan(0);
    expect(persisted).toEqual(result);
    expect(feedback).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
  });
  it("does not call the provider when saving inputs fails or the description is invalid", async () => {
    const feedback = vi.fn();
    const save = vi.fn().mockResolvedValue(false);
    await expect(
      runReview({
        record,
        resumeText: "React",
        jobDescription,
        feedback,
        save,
      }),
    ).rejects.toThrow("save");
    await expect(
      runReview({
        record,
        resumeText: "React",
        jobDescription: "",
        feedback,
        save,
      }),
    ).rejects.toThrow("description");
    expect(feedback).not.toHaveBeenCalled();
  });
  it("reports a final persistence failure instead of claiming results were saved", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(
      runReview({
        record,
        resumeText: "React",
        jobDescription,
        feedback: vi.fn().mockResolvedValue(response),
        save,
      }),
    ).rejects.toThrow("save");
  });
});

describe("saved feedback loading", () => {
  it("suppresses saved unavailable-document feedback without mutating or rewriting the record", () => {
    const feedback = JSON.parse(response.message.content as string) as Feedback;
    feedback.content.tips[0].explanation = "I cannot access the resume.";
    const saved: Resume = { ...record, status: "ready", feedback, match: matchJob("React", jobDescription) };
    const before = structuredClone(saved);
    const displayed = prepareSavedReview(saved);
    expect(displayed.status).toBe("failed");
    expect(displayed.error).toContain("AI could not evaluate");
    expect(displayed.feedback).toBeUndefined();
    expect(displayed.match).toEqual(saved.match);
    expect(displayed.resumePath).toBe(saved.resumePath);
    expect(displayed.imagePath).toBe(saved.imagePath);
    expect(saved).toEqual(before);
  });

  it("preserves saved valid zero scores", () => {
    const feedback = JSON.parse(response.message.content as string) as Feedback;
    feedback.overallScore = 0;
    feedback.ATS.score = 0;
    for (const category of [feedback.toneAndStyle, feedback.content, feedback.structure, feedback.skills]) category.score = 0;
    const displayed = prepareSavedReview({ ...record, status: "ready", feedback });
    expect(displayed.status).toBe("ready");
    expect(displayed.feedback?.overallScore).toBe(0);
  });

  it("rejects invalid saved shapes while retaining a previous failure without feedback", () => {
    expect(prepareSavedReview({ ...record, status: "ready" }).feedback).toBeUndefined();
    const failed = { ...record, status: "failed" as const, feedback: undefined, error: "Previous safe error" };
    expect(prepareSavedReview(failed)).toEqual(failed);
  });
});
