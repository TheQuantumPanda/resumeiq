export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_JOB_LENGTH = 15000;
// A character budget for the AI input, not a token count or a PDF upload limit.
export const MAX_AI_RESUME_TEXT_LENGTH = 30000;

export const hasUsableResumeText = (text: string): boolean =>
  Boolean(text.trim()) && /[\p{L}\p{N}]/u.test(text);

export function validateAIResumeText(text: string): string | null {
  if (!hasUsableResumeText(text))
    return "No usable resume text is available for AI analysis. Your existing keyword result is preserved.";
  if (text.length > MAX_AI_RESUME_TEXT_LENGTH)
    return "The extracted resume text exceeds the 30,000-character AI limit. Use a shorter resume; no content was truncated. Your keyword result is preserved.";
  return null;
}

export function validateResumeFile(
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  if (
    !/\.pdf$/i.test(file.name) ||
    (file.type && file.type !== "application/pdf")
  ) {
    return "Choose a PDF file (.pdf).";
  }
  if (file.size === 0) return "This file is empty. Choose a text-based PDF.";
  if (file.size > MAX_PDF_BYTES) return "Choose a PDF smaller than 10 MB.";
  return null;
}

export function validateJobDescription(value: string): string | null {
  const text = value.trim();
  if (text.length < 50 || (text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) < 8) {
    return "Paste a job description with at least 50 characters and 8 words.";
  }
  if (text.length > MAX_JOB_LENGTH)
    return "Keep the job description under 15,000 characters.";
  return null;
}
