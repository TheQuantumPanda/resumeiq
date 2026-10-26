import { analyzeWithPuter } from "./analyzePuter";
import { matchJob } from "./matching";
import { hasUsableResumeText, validateJobDescription } from "./validation";
import { validateFeedback } from "./feedback.schema";

// Apply the current feedback checks in memory; never migrate or save on load.
export function prepareSavedReview(record: Resume): Resume {
  if (!record.feedback) return { ...record, feedback: undefined };
  try {
    return { ...record, feedback: validateFeedback(record.feedback) };
  } catch (error) {
    return {
      ...record,
      feedback: undefined,
      status: "failed",
      error: error instanceof Error ? error.message : "Saved AI feedback is unavailable.",
    };
  }
}

// Save the input snapshot before AI, so interrupted reviews can be retried honestly.
export async function runReview({
  record,
  resumeText,
  jobDescription,
  feedback,
  save,
}: {
  record: Resume;
  resumeText: string;
  jobDescription: string;
  feedback: (
    messages: ChatMessage[],
    signal?: AbortSignal,
  ) => Promise<AIResponse | undefined>;
  save: (key: string, value: string) => Promise<boolean | undefined>;
}): Promise<Resume> {
  const error = validateJobDescription(jobDescription);
  if (error) throw new Error(error);
  const pending: Resume = {
    ...record,
    jobDescription: jobDescription.trim(),
    match: hasUsableResumeText(resumeText)
      ? matchJob(resumeText, jobDescription)
      : record.match,
    feedback: undefined,
    status: "analyzing",
    error: undefined,
  };
  const persist = async (value: Resume) => {
    if (!(await save(`resume:${record.id}`, JSON.stringify(value)))) {
      throw new Error(
        "Could not confirm this review was saved to Puter. Displayed results are from the previous completed run. Reload to check the saved state before retrying.",
      );
    }
  };
  await persist(pending);
  let updated: Resume;
  try {
    const result = await analyzeWithPuter({
      resumeText,
      jobTitle: record.jobTitle ?? "",
      jobDescription: pending.jobDescription!,
      feedback,
    });
    updated = { ...pending, feedback: result, status: "ready" };
  } catch (error) {
    updated = {
      ...pending,
      status: "failed",
      error:
        error instanceof Error
          ? error.message
          : "AI review failed. Retry when ready.",
    };
  }
  await persist(updated);
  return updated;
}
