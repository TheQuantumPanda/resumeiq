import {
  buildFeedbackMessages,
  validateFeedback,
} from "./feedback.schema";
import type { FeedbackResult } from "./feedback.schema";
import { validateAIResumeText } from "./validation";

export const extractJson = (text: string): unknown => {
  if (text.length > 60000)
    throw new Error("Puter AI returned too much feedback. Try again.");
  try {
    return JSON.parse(
      text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "").trim(),
    );
  } catch {
    throw new Error(
      "Puter AI returned malformed JSON. Try the analysis again.",
    );
  }
};

export const readMessageText = (response: AIResponse): string => {
  if (
    response.finish_reason &&
    !["stop", "end_turn"].includes(response.finish_reason)
  ) {
    throw new Error(
      "Puter AI did not complete the review. Try the analysis again.",
    );
  }
  const content: unknown = response.message?.content;
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .filter(
        (part) =>
          part &&
          typeof part.text === "string" &&
          (!part.type || part.type === "text"),
      )
      .map((part) => part.text)
      .join("");
    if (text.trim()) return text;
  }
  throw new Error("Puter AI returned an empty response. Try again.");
};

// Inspect only bounded, known error fields. Never log, retain or echo raw provider data.
export function providerError(error: unknown): string {
  const fields: string[] = [];
  const statuses: number[] = [];
  const seen = new Set<object>();
  const inspect = (value: unknown, depth = 0): void => {
    if (depth > 4) return;
    if (typeof value === "string") {
      fields.push(value.slice(0, 1000));
      return;
    }
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    const data = value as Record<string, unknown>;
    for (const key of ["code", "errorCode", "type", "name", "message"]) {
      if (typeof data[key] === "string") fields.push(data[key].slice(0, 1000));
    }
    for (const key of ["status", "statusCode"]) {
      const status = data[key];
      if (typeof status === "number") statuses.push(status);
    }
    // Puter can reject with { error: { code, message } } or a string error.
    // Some delegated provider failures add another error/cause layer.
    inspect(data.error, depth + 1);
    inspect(data.cause, depth + 1);
  };
  inspect(error);
  const detail = fields.join(" ").toLowerCase();
  if (
    /email[_ -](?:must[_ -]be[_ -]confirmed|confirmation|required|not[_ -]verified)|verify your email/.test(
      detail,
    )
  ) {
    return "Puter requires email verification. Confirm your email in Puter, then retry your review.";
  }
  if (
    statuses.includes(402) ||
    /insufficient[_ -](?:funds|credits|balance|quota)|not enough (?:funds|credits)|subscription[_ -]required|billing|quota[_ -]exceeded/.test(
      detail,
    )
  ) {
    return "Puter AI allowance or credits are insufficient. Check your Puter account allowance before retrying.";
  }
  if (
    statuses.includes(401) ||
    statuses.includes(403) ||
    /(?:\b|_)auth(?:[_ -]|entication|orization)|sign.?in|permission|unauthorized|forbidden|access[_ -]denied/.test(
      detail,
    )
  ) {
    return "Puter needs authorization. Sign in again, then retry your review.";
  }
  if (
    /model[_ -](?:not[_ -]found|unavailable|not[_ -]available|not[_ -]supported)|unknown[_ -]model|invalid[_ -]model|unsupported[_ -]model|no (?:available )?provider|model[^\n]{0,160}(?:does not exist|not found|not available|unavailable|not supported)/.test(
      detail,
    )
  ) {
    return "The configured AI model is unavailable through Puter. Check the model configuration before retrying. Your keyword match is still available.";
  }
  if (
    statuses.includes(429) ||
    /rate[_ -]limit|too many requests|credits_reserved|quota|credit|balance/.test(
      detail,
    )
  ) {
    return "Puter usage or rate limit reached. Check your account allowance or wait before retrying.";
  }
  if (
    /request[_ -]timeout|timed?[_ -]out|timeout/.test(detail) ||
    statuses.includes(408) ||
    statuses.includes(504)
  ) {
    return "Puter AI timed out. Retry manually when ready; the previous request may still count toward your allowance.";
  }
  if (/aborterror|request[_ -]cancelled|request[_ -]canceled/.test(detail)) {
    return "The Puter AI request was cancelled. Retry manually when ready; the previous request may still count toward your allowance.";
  }
  if (
    statuses.includes(413) ||
    /input[_ -]too[_ -]large|context[_ -]length|maximum context|too many tokens|document[_ -]too[_ -]large/.test(
      detail,
    )
  ) {
    return "The AI provider rejected the input size. Use a shorter resume or job description before retrying.";
  }
  if (
    /unsupported[_ -](?:file|document|media)|invalid[_ -](?:file|document|pdf)|(?:file|document|pdf)[^.]{0,80}(?:not supported|unreadable|invalid)/.test(
      detail,
    )
  ) {
    return "The AI provider could not read the attached PDF. Export an unlocked text-based PDF and retry.";
  }
  if (
    statuses.includes(400) ||
    statuses.includes(422) ||
    /invalid[_ -](?:argument|request|parameter)|bad[_ -]request/.test(detail)
  ) {
    return "Puter or its AI provider rejected the review request. Check the model and document compatibility before retrying.";
  }
  if (/invalid[_ -](?:stream[_ -])?response|syntaxerror/.test(detail)) {
    return "Puter returned an invalid provider response before feedback could be validated. Retry manually when ready.";
  }
  if (
    statuses.some((status) => status >= 500 && status <= 599) ||
    /overloaded|service[_ -]unavailable|provider[_ -](?:error|unavailable)/.test(
      detail,
    )
  ) {
    return "Puter or its AI provider is temporarily unavailable. Wait before retrying; your keyword match is still available.";
  }
  if (
    statuses.includes(0) ||
    /network|failed to fetch|connection|load failed/.test(detail)
  ) {
    return "The Puter AI request could not reach the service. Check your connection before retrying. Your keyword match is still available.";
  }
  return "The Puter AI request failed before feedback was received. The provider reason could not be classified safely. Your keyword match is still available.";
}

export async function analyzeWithPuter({
  resumeText,
  jobTitle,
  jobDescription,
  feedback,
  timeoutMs = 90000,
}: {
  resumeText: string;
  jobTitle: string;
  jobDescription: string;
  feedback: (
    messages: ChatMessage[],
    signal?: AbortSignal,
  ) => Promise<AIResponse | undefined>;
  timeoutMs?: number;
}): Promise<FeedbackResult> {
  const inputError = validateAIResumeText(resumeText);
  if (inputError) throw new Error(inputError);
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let response: AIResponse | undefined;
  try {
    response = await Promise.race([
      feedback(
        buildFeedbackMessages({ resumeText, jobTitle, jobDescription }),
        controller.signal,
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("REVIEW_TIMEOUT"));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(
        "Puter AI timed out. Retry manually when ready; the previous request may still count toward your allowance.",
      );
    }
    throw new Error(providerError(error));
  } finally {
    clearTimeout(timer);
  }
  if (!response) throw new Error("Puter AI is unavailable. Please try again.");
  const parsed = validateFeedback(
    extractJson(readMessageText(response)),
  );
  // Use a visible, reproducible average instead of the model's unexplained overall number.
  return {
    ...parsed,
    overallScore: Math.round(
      (parsed.toneAndStyle.score +
        parsed.content.score +
        parsed.structure.score +
        parsed.skills.score) /
        4,
    ),
  };
}
