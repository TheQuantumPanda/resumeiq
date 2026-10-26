import { describe, expect, it } from "vitest";
import {
  MAX_PDF_BYTES,
  MAX_AI_RESUME_TEXT_LENGTH,
  validateAIResumeText,
  validateJobDescription,
  validateResumeFile,
} from "./validation";

describe("resume validation", () => {
  const pdf = { name: "resume.PDF", type: "application/pdf", size: 100 };
  it("accepts PDFs including browsers without a MIME type", () => {
    expect(validateResumeFile(pdf)).toBeNull();
    expect(validateResumeFile({ ...pdf, type: "" })).toBeNull();
  });
  it("rejects unsupported, disguised, empty and oversized files", () => {
    for (const file of [
      { ...pdf, name: "resume.txt" },
      { ...pdf, type: "image/png" },
      { ...pdf, size: 0 },
      { ...pdf, size: MAX_PDF_BYTES + 1 },
    ]) {
      expect(validateResumeFile(file)).not.toBeNull();
    }
  });
});
describe("AI resume text validation", () => {
  it.each(["", " \n\t ", "--- !!!"])("rejects unusable text %j", (text) => {
    expect(validateAIResumeText(text)).toContain("No usable resume text");
  });

  it("accepts the complete text at the limit and rejects oversized text without truncation", () => {
    expect(validateAIResumeText("a".repeat(MAX_AI_RESUME_TEXT_LENGTH))).toBeNull();
    expect(validateAIResumeText("a".repeat(MAX_AI_RESUME_TEXT_LENGTH + 1)))
      .toContain("no content was truncated");
  });

  it("accepts Unicode text", () => {
    expect(validateAIResumeText("学生の履歴書\n软件开发项目")).toBeNull();
  });
});
describe("job description validation", () => {
  it("rejects empty, tiny, huge and meaningless input", () => {
    for (const text of [
      "",
      "   ",
      "SQL",
      "x".repeat(100),
      "! ".repeat(100),
      "word ".repeat(4000),
    ])
      expect(validateJobDescription(text)).not.toBeNull();
  });
  it("accepts a realistic description", () => {
    expect(
      validateJobDescription(
        "Build React interfaces with TypeScript and SQL. Write unit tests and collaborate with designers.",
      ),
    ).toBeNull();
  });
});
