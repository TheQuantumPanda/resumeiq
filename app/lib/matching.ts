// A deliberately small, editable vocabulary. No model or network call is involved.
const SKILLS = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "c++",
  "c#",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "react",
  "angular",
  "vue",
  "node.js",
  "next.js",
  ".net",
  "django",
  "flask",
  "spring",
  "express",
  "html",
  "css",
  "tailwind",
  "sql",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "git",
  "github",
  "docker",
  "kubernetes",
  "aws",
  "azure",
  "gcp",
  "linux",
  "rest api",
  "graphql",
  "ci/cd",
  "unit testing",
  "vitest",
  "jest",
  "playwright",
  "agile",
  "data structures",
  "algorithms",
  "machine learning",
  "data analysis",
  "excel",
  "power bi",
  "tableau",
  "figma",
  "communication",
  "leadership",
  "project management",
  "customer service",
  "accounting",
  "marketing",
  "sales",
  "research",
] as const;
const STOPWORDS = new Set(
  `a an and are as at be been being by can candidate candidates company degree description duties education employer employment equal experience experienced for from full have has hiring in including is it job join knowledge looking must of on opportunity or our position preferred qualifications required requirements responsibilities role skills strong team the their this to we will with work working years you your ability about all also any apply benefits build business competitive develop excellent good help ideal learn new offers other please provide relevant salary seeking successful support through time using well who would`.split(
    " ",
  ),
);

export function normalizeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\bc\+\+/g, " cplusplus ")
    .replace(/\bc#/g, " csharp ")
    .replace(/(?:\basp\.)?\.net\b/g, " dotnet ")
    .replace(/\bnode[.\s-]?js\b/g, " nodejs ")
    .replace(/\bnext[.\s-]?js\b/g, " nextjs ")
    .replace(/\breact(?:[.\s-]?js)\b/g, " react ")
    .replace(/\bvue(?:[.\s-]?js)\b/g, " vue ")
    .replace(/\bpostgres\b/g, " postgresql ")
    .replace(/\bk8s\b/g, " kubernetes ")
    .replace(/\bci\s*[/\s-]\s*cd\b/g, " cicd ")
    .replace(/\brestful\s+apis?\b|\brest\s+apis\b/g, " rest api ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export interface MatchResult {
  version: 1;
  method: "skills" | "keywords";
  terms: string[];
  matched: string[];
  missing: string[];
  score: number | null;
}

const contains = (text: string, term: string) =>
  ` ${text} `.includes(` ${normalizeText(term)} `);

export function matchJob(
  resumeText: string,
  jobDescription: string,
): MatchResult {
  const job = normalizeText(jobDescription);
  let terms: string[] = SKILLS.filter((skill) => contains(job, skill));
  const method = terms.length ? "skills" : "keywords";
  if (!terms.length) {
    // For roles outside the vocabulary, use up to 25 long, non-boilerplate words.
    const counts = new Map<string, number>();
    for (const word of job.split(" ")) {
      if (word.length >= 4 && !STOPWORDS.has(word) && !/^\d+$/.test(word)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
    terms = [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 25)
      .map(([word]) => word);
  }
  const resume = normalizeText(resumeText);
  const matched = terms.filter((term) => contains(resume, term));
  const missing = terms.filter((term) => !contains(resume, term));
  return {
    version: 1,
    method,
    terms,
    matched,
    missing,
    score: terms.length
      ? Math.round((100 * matched.length) / terms.length)
      : null,
  };
}
