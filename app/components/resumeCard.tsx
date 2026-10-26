import { Link } from "react-router";
import ScoreBadge from "~/components/scoreBadge";
import { useEffect, useState } from "react";
import { usePuterStore } from "../lib/puter";
import { resumeScore } from "../lib/utils";

const ResumeCard = ({
  resume,
  onDelete,
}: {
  resume: Resume;
  onDelete?: (resume: Resume) => void;
}) => {
  const { id, companyName, jobTitle, imagePath, createdAt, status } = resume;
  const score = resumeScore(resume);
  const { fs } = usePuterStore();
  const [resumeUrl, setResumeUrl] = useState("");
  // "loading" until the read settles, so a failed read shows a message and not a
  // forever-skeleton. A puter path is never a usable <img src>, so there is no fallback.
  const [previewState, setPreviewState] = useState<"loading" | "error">(
    "loading",
  );
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let url = "";
    let cancelled = false;

    const loadResume = async () => {
      const blob = imagePath
        ? await fs.read(imagePath).catch(() => null)
        : null;
      if (cancelled) return;
      if (!blob) return setPreviewState("error");
      url = URL.createObjectURL(blob);
      setResumeUrl(url);
    };

    setPreviewState("loading");
    setResumeUrl("");
    loadResume();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imagePath]);

  // reset the confirm prompt if the user wanders off instead of deciding
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <article className="resume-card-wrapper">
      <Link to={`/resume/${id}`} className="resume-card">
        <div className="card-preview">
          {resumeUrl ? (
            <img
              src={resumeUrl}
              alt={`Resume preview for ${jobTitle || companyName || "your review"}`}
            />
          ) : (
            <div className="card-preview-fallback">
              {previewState === "error"
                ? "Preview unavailable"
                : "Loading preview…"}
            </div>
          )}
        </div>
        <div className="resume-card-body">
          <p className="card-company">{companyName || "Resume review"}</p>
          <h2>{jobTitle || companyName || "Resume"}</h2>
          <div className="card-meta">
            {score !== null ? (
              <ScoreBadge score={score} />
            ) : status === "analyzing" ? (
              <span className="status-pill warning">Analyzing</span>
            ) : status === "failed" ? (
              <span className="status-pill danger">Analysis failed</span>
            ) : (
              <span className="status-pill neutral">Rerun for coverage</span>
            )}
            {createdAt && (
              <span>
                {new Date(createdAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        </div>
        <div className="card-score">
          <div>
            <strong>{score !== null ? `${score}%` : "—"}</strong>
            <small>Keyword coverage</small>
          </div>
          <span className="card-open">
            View review <span aria-hidden="true">↗</span>
          </span>
        </div>
      </Link>
      {onDelete && (
        <div className="card-delete">
          {confirming && (
            <button
              type="button"
              className="delete-confirm"
              onClick={() => onDelete(resume)}
            >
              Delete?
            </button>
          )}
          <button
            type="button"
            aria-label={confirming ? "Cancel delete" : "Remove resume"}
            title={confirming ? "Cancel" : "Remove resume"}
            className="icon-button"
            onClick={() => setConfirming((c) => !c)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      )}
    </article>
  );
};
export default ResumeCard;
