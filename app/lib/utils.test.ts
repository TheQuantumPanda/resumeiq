import { describe, expect, it } from "vitest";
import {
  filterAndSortResumes,
  formatSize,
  resumeScore,
  resumeStats,
} from "./utils";

const resume = (overrides: Partial<Resume> = {}): Resume =>
  ({
    id: Math.random().toString(36).slice(2),
    imagePath: "/image.png",
    resumePath: "/resume.pdf",
    ...overrides,
  }) as Resume;

const scored = (score: number, overrides: Partial<Resume> = {}) =>
  resume({ match: { version: 1, method: "skills", terms: [], matched: [], missing: [], score }, ...overrides });

describe("resumeScore", () => {
  it("reads the deterministic coverage score", () => {
    expect(resumeScore(scored(82))).toBe(82);
  });

  it("returns null for legacy records without deterministic matching", () => {
    expect(resumeScore(resume())).toBeNull();
    expect(resumeScore(resume({ feedback: "" as unknown as Feedback }))).toBeNull();
    expect(
      resumeScore(resume({ feedback: {} as Feedback })),
    ).toBeNull();
  });
});

describe("resumeStats", () => {
  it("is null with no resumes", () => {
    expect(resumeStats([])).toBeNull();
  });

  it("ignores unscored resumes instead of returning NaN", () => {
    const stats = resumeStats([scored(80), scored(60), resume()]);

    expect(stats).toEqual({ total: 3, average: 70, best: 80 });
  });

  it("reports no average when nothing has been scored", () => {
    expect(resumeStats([resume(), resume()])).toEqual({
      total: 2,
      average: null,
      best: null,
    });
  });
});

describe("filterAndSortResumes", () => {
  const google = scored(70, { companyName: "Google", jobTitle: "Backend Engineer", createdAt: "2026-01-01" });
  const acme = scored(90, { companyName: "Acme", jobTitle: "Designer", createdAt: "2026-03-01" });
  const pending = resume({ companyName: "Zeta", createdAt: "2026-02-01" });
  const all = [google, acme, pending];

  it("matches company and job title, case insensitively", () => {
    expect(filterAndSortResumes(all, "goog", "recent")).toEqual([google]);
    expect(filterAndSortResumes(all, "DESIGNER", "recent")).toEqual([acme]);
    expect(filterAndSortResumes(all, "  ", "recent")).toHaveLength(3);
  });

  it("sorts by score with unscored resumes last in both directions", () => {
    expect(filterAndSortResumes(all, "", "score-desc")).toEqual([acme, google, pending]);
    expect(filterAndSortResumes(all, "", "score-asc")).toEqual([google, acme, pending]);
  });

  it("sorts newest first", () => {
    expect(filterAndSortResumes(all, "", "recent")).toEqual([acme, pending, google]);
  });

  it("sorts by company name", () => {
    expect(filterAndSortResumes(all, "", "company")).toEqual([acme, google, pending]);
  });

  it("does not mutate the input", () => {
    const input = [...all];
    filterAndSortResumes(input, "", "score-desc");
    expect(input).toEqual(all);
  });
});

describe("formatSize", () => {
  it("formats byte counts", () => {
    expect(formatSize(0)).toBe("0 Bytes");
    expect(formatSize(1024)).toBe("1 KB");
    expect(formatSize(20 * 1024 * 1024)).toBe("20 MB");
  });
});
