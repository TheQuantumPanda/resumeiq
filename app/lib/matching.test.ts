import { describe, expect, it } from "vitest";
import { matchJob, normalizeText } from "./matching";

describe("text normalization and keyword coverage", () => {
  it("normalizes punctuation, whitespace, case and supported aliases", () => {
    expect(
      normalizeText(" REACT.js, Node.js; Postgres\nK8s CI/CD C++ C# .NET "),
    ).toBe("react nodejs postgresql kubernetes cicd cplusplus csharp dotnet");
  });
  it("counts each detected skill once and explains its denominator", () => {
    const result = matchJob(
      "Built React and TypeScript interfaces.",
      "React React TypeScript SQL",
    );
    expect(result.matched).toEqual(["typescript", "react"]);
    expect(result.missing).toEqual(["sql"]);
    expect(result.score).toBe(67);
    expect(result.terms).toHaveLength(3);
  });
  it("does not confuse java with javascript, git with github or c with c++", () => {
    const result = matchJob("JavaScript GitHub C++", "Java Git C");
    expect(result.matched).toEqual([]);
    expect(result.score).toBe(0);
  });
  it("handles multiword skills and aliases", () => {
    expect(
      matchJob(
        "RESTful APIs, node js, Postgres, CI-CD",
        "REST API Node.js PostgreSQL CI/CD",
      ).score,
    ).toBe(100);
  });
  it("falls back to non-boilerplate keywords for other roles", () => {
    const result = matchJob(
      "Irrigation and horticulture",
      "Horticulture horticulture irrigation pruning",
    );
    expect(result.method).toBe("keywords");
    expect(result.missing).toEqual(["pruning"]);
    expect(result.score).toBe(67);
  });
  it("does not manufacture a score when no useful terms exist", () => {
    expect(matchJob("resume", " ").score).toBeNull();
    expect(
      matchJob("resume", "the and job role requirements").score,
    ).toBeNull();
  });
});
