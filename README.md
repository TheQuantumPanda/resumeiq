# ResumeIQ

A browser-based resume reviewer that combines explainable job-description keyword matching with separate AI writing feedback.

Upload a text-based PDF, paste a job description, inspect matched and potentially missing terms, and review writing suggestions. Saved reviews support search, sorting, deletion and manual reruns.

## Setup

Use **Node.js 24+** and npm. Cloud features require internet access, a Puter account and sufficient usage allowance. No application API key or environment file is required; Puter AI usage may incur charges for the signed-in user.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`, and sign in through Puter.

## How it works

React Router SPA, React, TypeScript, Tailwind, Zustand, PDF.js, Zod and Puter. No custom backend or database.

- **PDF processing:** PDF.js extracts text across all pages and renders a first-page preview. The original PDF and preview are saved in the user's Puter storage.
- **Keyword compatibility:** deterministic whole-term matching with a small skills vocabulary, aliases and a general-keyword fallback. Coverage is `round(matched unique terms / detected unique terms * 100)`; no detected terms means no numeric score.
- **AI feedback:** extracted resume text and role details are sent through Puter AI to `claude-sonnet-4.5`, without a PDF attachment. Trusted instructions and untrusted resume/job data are separated. Zod and a narrow unavailable-document check validate feedback before display.
- **Independent results:** AI writing quality is the rounded mean of tone/style, content, structure and skills. Readability and keyword coverage are excluded. AI failure preserves keyword results; retries are manual.

## Checks and build

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

`npm start` previews `build/client`, normally at `http://localhost:4173`. Automated tests use mocked PDF/provider boundaries. Real authenticated, resume-specific AI analysis has also been confirmed through user testing; this does not establish account isolation or hosted-origin behavior.

Static hosting requires HTTPS and an `index.html` fallback for application routes. `public/_redirects` supplies that fallback for compatible hosts. Test Puter permissions on the eventual host before release.

## Privacy and limitations

Selecting a PDF processes it locally. Choosing Analyze uploads the PDF and preview, saves the description/results in Puter KV, and sends extracted text through Puter AI to the model provider. Extracted text is not separately persisted; reruns extract it again from the stored PDF. See [Puter security](https://docs.puter.com/security/) and [AI documentation](https://docs.puter.com/AI/chat/).

- Text-based PDFs only: up to 10 MB and 20 pages; no OCR. AI input is limited to 30,000 resume-text characters without silent truncation.
- AI requests are non-streaming, capped at 4,096 output tokens and use a 90-second deadline. Known truncation is rejected; a timeout may still consume provider allowance.
- Keyword presence does not establish proficiency or suitability. The vocabulary is small and English-focused; PDF reading order and hidden text can affect results.
- AI readability evaluates extracted text, not visual PDF formatting. Validation does not prove factual accuracy: verify every suggestion and never add invented qualifications. Scores are not employer ATS scores or hiring predictions.
- Use fictional resumes for demonstrations. Per-review deletion removes the record and attempts file cleanup; unsuccessful cleanup may require manual removal in Puter.
