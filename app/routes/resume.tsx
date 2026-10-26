import { Link, useNavigate, useParams } from "react-router";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { usePuterStore } from "~/lib/puter";
import Summary from "~/components/summary";
import ATS from "~/components/ATS";
import Details from "~/components/details";
import JobMatch from "~/components/jobMatch";
import { prepareSavedReview, runReview } from "~/lib/review";
import { convertPdfToImage } from "~/lib/pdf2img";
import { MAX_JOB_LENGTH, validateJobDescription } from "~/lib/validation";
import { BRAND } from "~/lib/brand";

export const meta = () => [{ title: `${BRAND.name} | Review` }];

export default function ResumeReview() {
  const { auth, isLoading, fs, kv, ai } = usePuterStore();
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<Resume | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [retrying, setRetrying] = useState(false);
  const busy = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    if (!isLoading && !auth.isAuthenticated)
      navigate(`/auth?next=/resume/${id}`);
  }, [isLoading, auth.isAuthenticated, id, navigate]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const current = ++generation.current;
    let cancelled = false;
    const urls: string[] = [];
    setRecord(null);
    setLoaded(false);
    setError("");
    setImageUrl("");
    setPdfUrl("");
    setPreviewError("");
    setRetrying(false);
    busy.current = false;
    const load = async () => {
      try {
        const value = await kv.get(`resume:${id}`);
        if (cancelled) return;
        if (!value) {
          setLoaded(true);
          return;
        }
        let data = JSON.parse(value) as Resume;
        if (
          data.id !== id ||
          typeof data.resumePath !== "string" ||
          (typeof data.jobDescription !== "string" &&
            data.jobDescription !== undefined)
        )
          throw new Error();
        data = prepareSavedReview(data);
        setRecord(data);
        setJobDescription(data.jobDescription ?? "");
        setLoaded(true);
        const [pdf, image] = await Promise.all([
          fs.read(data.resumePath).catch(() => null),
          data.imagePath ? fs.read(data.imagePath).catch(() => null) : null,
        ]);
        if (cancelled || current !== generation.current) return;
        if (pdf) {
          const url = URL.createObjectURL(
            new Blob([pdf], { type: "application/pdf" }),
          );
          urls.push(url);
          setPdfUrl(url);
        }
        if (image) {
          const url = URL.createObjectURL(image);
          urls.push(url);
          setImageUrl(url);
        }
        if (!pdf || !image)
          setPreviewError(
            "Some preview files are unavailable. Re-upload the PDF if it has been removed from Puter.",
          );
      } catch {
        if (!cancelled) {
          setError(
            "Could not load this saved review. Check your Puter connection and reload.",
          );
          setLoaded(true);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
      generation.current++;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [id, auth.isAuthenticated, fs, kv]);

  const rerun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record || busy.current) return;
    const validation = validateJobDescription(jobDescription);
    if (validation) return setError(validation);
    busy.current = true;
    setRetrying(true);
    setError("");
    const current = generation.current;
    try {
      const blob = await fs.read(record.resumePath);
      if (!blob)
        throw new Error(
          "The stored PDF is unavailable. Upload your resume again.",
        );
      const prepared = await convertPdfToImage(
        new File([blob], "resume.pdf", { type: "application/pdf" }),
      );
      URL.revokeObjectURL(prepared.imageUrl);
      if (!prepared.text)
        throw new Error(prepared.error ?? "Could not read the PDF.");
      const updated = await runReview({
        record,
        resumeText: prepared.text,
        jobDescription,
        feedback: ai.feedback,
        save: kv.set,
      });
      if (current === generation.current) {
        setRecord(updated);
        setJobDescription(updated.jobDescription ?? "");
      }
    } catch (error) {
      if (current === generation.current)
        setError(
          error instanceof Error
            ? error.message
            : "Could not rerun this review. Check your Puter connection.",
        );
    } finally {
      if (current === generation.current) {
        busy.current = false;
        setRetrying(false);
      }
    }
  };

  return (
    <main>
      <nav className="resume-nav" aria-label="Review navigation">
        <Link to="/" className="back-button">
          ← All reviews
        </Link>
        <Link to="/" className="brand" aria-label={`${BRAND.name} home`}>
          <span className="wordmark">{BRAND.name}</span>
        </Link>
      </nav>
      <div className="report-shell">
        <header className="report-heading">
          <p className="eyebrow clay">Your application, in perspective</p>
          <h1>Resume review</h1>
          <p>
            {record?.jobTitle || "Your target role"}
            {record?.companyName ? ` · ${record.companyName}` : ""}
          </p>
        </header>
        <div className="review-grid">
          <section className="report-content" aria-label="Analysis results">
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {!loaded && (
              <p role="status" className="loading-state">
                Loading your saved review…
              </p>
            )}
            {record && (
              <>
                {record.warnings?.map((warning) => (
                  <p className="notice" key={warning}>
                    {warning}
                  </p>
                ))}
                {record.match && <JobMatch match={record.match} />}
                <details className="saved-description">
                  <summary>Description used for displayed results</summary>
                  <p>
                    {record.jobDescription ||
                      "No description saved. Add one below and rerun."}
                  </p>
                </details>
                {(record.status === "failed" ||
                  record.status === "analyzing") && (
                  <p role="status" className="notice">
                    {record.status === "analyzing"
                      ? "The last AI review was interrupted. Rerun below when ready."
                      : (record.error ??
                        "The AI review failed. Rerun below when ready.")}
                  </p>
                )}
                {record.feedback ? (
                  <>
                    <header className="report-section-heading">
                      <p className="eyebrow clay">
                        A writing coach's perspective
                      </p>
                      <h2>Refine the way you tell your story.</h2>
                    </header>
                    <p className="notice">
                      AI writing feedback is advisory. Check every suggestion
                      against your actual experience. Never add unverified
                      skills, credentials or accomplishments.
                    </p>
                    <Summary feedback={record.feedback} />
                    <ATS
                      score={record.feedback.ATS.score}
                      suggestions={record.feedback.ATS.tips}
                    />
                    <Details feedback={record.feedback} />
                  </>
                ) : (
                  <p className="notice">
                    No validated AI writing feedback yet. Your keyword match
                    remains useful; rerun below to request suggestions.
                  </p>
                )}
                <section
                  className="panel rerun-panel"
                  aria-labelledby="rerun-heading"
                >
                  <p className="eyebrow">Revisit your target role</p>
                  <h2 id="rerun-heading">
                    A different role. A fresh perspective.
                  </h2>
                  <form onSubmit={rerun}>
                    <label htmlFor="edit-job">Job description</label>
                    <textarea
                      id="edit-job"
                      rows={6}
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      maxLength={MAX_JOB_LENGTH}
                      disabled={retrying}
                      required
                      aria-describedby="rerun-help"
                    />
                    <p id="rerun-help" className="field-help">
                      Results above use the last saved description. Editing
                      takes effect when you rerun. Each rerun uses Puter AI
                      allowance.
                    </p>
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={retrying}
                    >
                      {retrying
                        ? "Analyzing this resume and description…"
                        : "Save description & rerun analysis"}
                    </button>
                  </form>
                  {retrying && (
                    <p role="status" className="notice">
                      Reading your saved PDF and requesting a new review.
                      Existing results above remain tied to their saved
                      description.
                    </p>
                  )}
                </section>
              </>
            )}
            {loaded && !record && (
              <div className="panel">
                <h2>This review is unavailable.</h2>
                <Link to="/upload" className="text-link">
                  Start a new review
                </Link>
              </div>
            )}
          </section>
          <aside className="panel preview-panel">
            <p className="eyebrow">The original document</p>
            <h2>Your resume</h2>
            <p className="field-help">
              {record?.fileName ?? "Saved PDF"}
              {record?.pageCount ? ` · ${record.pageCount} page(s)` : ""}
            </p>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="First page of your resume"
                className="pdf-preview"
              />
            ) : (
              <p className="field-help">
                {loaded ? "Preview unavailable." : "Loading preview…"}
              </p>
            )}
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="text-link"
              >
                Open full PDF · all pages ↗
              </a>
            )}
            {previewError && <p className="notice">{previewError}</p>}
          </aside>
        </div>
        <footer className="page-footer">
          <span>ResumeIQ · A considered next step</span>
          <span>Your potential is more than a percentage.</span>
        </footer>
      </div>
    </main>
  );
}
