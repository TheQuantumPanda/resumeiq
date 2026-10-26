import { type FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import Navbar from "~/components/navbar";
import FileUploader from "~/components/fileUploader";
import { usePuterStore } from "~/lib/puter";
import { convertPdfToImage, type PdfConversionResult } from "~/lib/pdf2img";
import { generateUUID } from "~/lib/utils";
import { validateJobDescription, MAX_JOB_LENGTH } from "~/lib/validation";
import { runReview } from "~/lib/review";
import { BRAND } from "~/lib/brand";

export const meta = () => [{ title: `${BRAND.name} | New review` }];

export default function Upload() {
  const { auth, fs, kv, ai } = usePuterStore();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [prepared, setPrepared] = useState<PdfConversionResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [reading, setReading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const selection = useRef(0);
  const busy = useRef(false);
  const previewUrl = useRef("");

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      setPdfUrl("");
    };
  }, [file]);
  useEffect(
    () => () => {
      selection.current++;
      URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  const selectFile = async (file: File | null) => {
    const request = ++selection.current;
    URL.revokeObjectURL(previewUrl.current);
    setFile(file);
    setPrepared(null);
    setError("");
    setReading(Boolean(file));
    if (!file) return;
    const result = await convertPdfToImage(file);
    if (request !== selection.current) {
      URL.revokeObjectURL(result.imageUrl);
      return;
    }
    previewUrl.current = result.imageUrl;
    setPrepared(result);
    setReading(false);
    if (result.error) setError(result.error);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy.current) return;
    const validation = validateJobDescription(jobDescription);
    if (validation) return setError(validation);
    if (!file || !prepared?.file || !prepared.text)
      return setError("Choose a readable PDF before analyzing.");
    if (!auth.isAuthenticated) {
      setError(
        "Sign in with Puter before analyzing. Your files are uploaded only after you choose Analyze.",
      );
      return;
    }
    const form = new FormData(event.currentTarget);
    busy.current = true;
    setProcessing(true);
    setError("");
    // Each analysis owns its files; deleting one review cannot break another.
    const folder = `resumeiq-${generateUUID()}`;
    let saved = false;
    let saveAttempted = false;
    const paths: string[] = [];
    try {
      setStatus("Saving your PDF and preview to your Puter account…");
      const pdf = await fs.write(`${folder}-resume.pdf`, file);
      if (!pdf)
        throw new Error(
          "Could not upload your PDF. Check Puter permissions and try again.",
        );
      paths.push(pdf.path);
      const image = await fs.write(`${folder}-preview.png`, prepared.file);
      if (!image)
        throw new Error(
          "Could not save your preview. Check Puter permissions and try again.",
        );
      paths.push(image.path);
      const record: Resume = {
        id: generateUUID(),
        resumePath: paths[0],
        imagePath: paths[1],
        fileName: file.name,
        companyName: String(form.get("company") ?? "").trim(),
        jobTitle: String(form.get("title") ?? "").trim(),
        createdAt: new Date().toISOString(),
        pageCount: prepared.pageCount,
        warnings: prepared.warnings,
      };
      setStatus("Matching keywords and requesting your AI writing review…");
      const result = await runReview({
        record,
        resumeText: prepared.text,
        jobDescription,
        feedback: ai.feedback,
        save: async (key, value) => {
          saveAttempted = true;
          const ok = await kv.set(key, value);
          if (ok) saved = true;
          return ok;
        },
      });
      navigate(`/resume/${result.id}`);
    } catch {
      // A pending record may already exist. Keep its files so it remains retryable.
      setError(
        saved
          ? "Your review was started, but its final save failed. Open the dashboard to retry the saved review."
          : "Could not save your review. Check your Puter sign-in, connection and storage permissions, then try again.",
      );
      // A rejected save can have reached the server; retain files if that outcome is uncertain.
      if (!saveAttempted)
        await Promise.allSettled(paths.map((path) => fs.delete(path)));
    } finally {
      busy.current = false;
      setProcessing(false);
      setStatus("");
    }
  };

  return (
    <main>
      <Navbar />
      <section className="workflow-shell">
        <header className="workflow-heading">
          <p className="eyebrow">A thoughtful application starts here</p>
          <h1>
            A clearer path to
            <br />
            your next role.
          </h1>
          <p className="lede">
            See where your resume aligns, then improve it with specific writing
            feedback.
          </p>
        </header>
        <form onSubmit={submit} className="workflow-grid">
          <fieldset disabled={processing}>
            <legend className="step-title">
              <span>01</span>Your resume
            </legend>
            <FileUploader onFileSelect={selectFile} />
            {reading && (
              <p role="status">Reading PDF pages and preparing your preview…</p>
            )}
            {prepared?.file && (
              <>
                <div className="preview-caption">
                  <span>
                    {prepared.pageCount} page(s) · text extracted locally
                  </span>
                  <a
                    className="text-link"
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open full PDF
                  </a>
                </div>
                <img
                  src={prepared.imageUrl}
                  alt="First page of your selected resume"
                  className="pdf-preview"
                />
                {prepared.warnings?.map((warning) => (
                  <p key={warning} className="notice">
                    {warning}
                  </p>
                ))}
              </>
            )}
            <p className="field-help">
              Text-based PDF · up to 10 MB and 20 pages. Scans need to be
              exported with selectable text first.
            </p>
          </fieldset>
          <fieldset disabled={processing}>
            <legend className="step-title">
              <span>02</span>Your target role
            </legend>
            <div className="form-pair">
              <div className="form-div">
                <label htmlFor="company">
                  Company <span className="field-help">(optional)</span>
                </label>
                <input
                  id="company"
                  name="company"
                  maxLength={100}
                  placeholder="e.g. Acme"
                />
              </div>
              <div className="form-div">
                <label htmlFor="title">
                  Job title <span className="field-help">(optional)</span>
                </label>
                <input
                  id="title"
                  name="title"
                  maxLength={100}
                  placeholder="e.g. Junior Developer"
                />
              </div>
            </div>
            <div className="form-div">
              <label htmlFor="job-description">Job description</label>
              <textarea
                id="job-description"
                name="job-description"
                rows={12}
                value={jobDescription}
                onChange={(e) => {
                  setJobDescription(e.target.value);
                  setError("");
                }}
                maxLength={MAX_JOB_LENGTH}
                required
                placeholder="Paste the role’s responsibilities, skills and requirements…"
                aria-describedby="job-help"
              />
              <p id="job-help" className="field-help">
                50–15,000 characters, at least 8 words.{" "}
                {jobDescription.length.toLocaleString()} / 15,000
              </p>
            </div>
            <p className="notice">
              Analyze saves your PDF, preview, job description and results in
              your Puter account and sends the PDF and role details through
              Puter AI. Your account’s usage limits and charges apply.
            </p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {processing && (
              <p role="status" aria-live="polite">
                {status}
              </p>
            )}
            <button
              className="primary-button"
              type="submit"
              disabled={processing || reading || !prepared?.file}
            >
              {processing ? "Analyzing…" : "Analyze compatibility"}
            </button>
          </fieldset>
        </form>
        <footer className="page-footer">
          <span>01 Upload · 02 Add a role · 03 Find your next steps</span>
          <span>
            Your experience stays yours. Keep every improvement truthful.
          </span>
        </footer>
      </section>
    </main>
  );
}
