import { BRAND } from "~/lib/brand";
import Navbar from "~/components/navbar";
import ResumeCard from "~/components/resumeCard";
import { usePuterStore } from "~/lib/puter";
import { Link, useNavigate } from "react-router";
import { useEffect, useMemo, useState } from "react";
import { filterAndSortResumes, resumeStats, type SortKey } from "~/lib/utils";
import { useCountUp } from "~/lib/useCountUp";
import { prepareSavedReview } from "~/lib/review";

export function meta() {
  return [
    { title: BRAND.name },
    { name: "description", content: "Smart feedback for your next job!" },
  ];
}

const StatCard = ({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) => {
  const displayed = useCountUp(value ?? 0);

  return (
    <div className="stat-card">
      <p className="stat-value tabular-nums">
        {value === null ? "—" : displayed}
      </p>
      <p className="stat-label">{label}</p>
    </div>
  );
};

export default function Home() {
  const { auth, isLoading, kv, fs } = usePuterStore();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  // Wait for the session check to settle. Redirecting while it is still running
  // bounces a signed-in user through /auth on every visit.
  useEffect(() => {
    if (!isLoading && !auth.isAuthenticated) navigate("/auth?next=/");
  }, [isLoading, auth.isAuthenticated]);

  // kv.list reads the user's account, so it must not run before they are known
  // to be signed in - an unauthenticated call makes Puter raise its permission dialog.
  useEffect(() => {
    if (!auth.isAuthenticated) return;

    const loadResumes = async () => {
      setLoadingResumes(true);

      try {
        const resumes = (await kv.list("resume:*", true)) as KVItem[];
        if (!Array.isArray(resumes)) throw new Error();

        const parsedResumes = resumes?.map(
          (resume) => prepareSavedReview(JSON.parse(resume.value) as Resume),
        );

        setResumes(parsedResumes || []);
        setLoadingResumes(false);

        // Permission is already granted by the read above, so this costs no extra prompt.
        if (!auth.user) auth.refreshUser().catch(() => null);
      } catch {
        setLoadError(
          "Could not load saved reviews. Check Puter permissions and reload.",
        );
      } finally {
        setLoadingResumes(false);
      }
    };

    loadResumes();
  }, [auth.isAuthenticated]);

  const handleDelete = async (resume: Resume) => {
    // The kv entry is what this list reads, so it goes first and has to succeed
    // before the card disappears - otherwise a failed delete comes back on reload.
    const key = `resume:${resume.id}`;
    const deleted = await kv
      .delete(key)
      // a falsy return is not proof of failure, so confirm by reading the key back
      .then((ok) => ok || kv.get(key).then((v) => v === null))
      .catch(() => false);

    if (!deleted) {
      setDeleteError(resume.companyName || "That resume");
      return;
    }

    setResumes((prev) => prev.filter((r) => r.id !== resume.id));

    // Best effort: a record can point at files that are already gone, and an
    // missing file should not prevent deleting the review.
    await Promise.all(
      [resume.resumePath, resume.imagePath]
        .filter(Boolean)
        .map((path) => fs.delete(path).catch(() => null)),
    );
  };

  const visibleResumes = useMemo(
    () => filterAndSortResumes(resumes, query, sort),
    [resumes, query, sort],
  );

  const stats = useMemo(() => resumeStats(resumes), [resumes]);

  return (
    <main className="dashboard">
      <Navbar />
      <section className="page-shell">
        <header className="page-heading">
          <p className="eyebrow clay">Your workspace</p>
          <h1>
            Every review,
            <br />
            one step forward.
          </h1>
          <p className="lede">
            {!isLoading && !loadingResumes && resumes?.length === 0
              ? "Your next chapter starts with a clearer story. Upload your first resume to begin."
              : "A collection of your applications, insights, and possibilities. Revisit a review and refine your next move."}
          </p>
        </header>
        {loadError && (
          <p role="alert" className="error-message">
            {loadError}
          </p>
        )}
        {deleteError && (
          <p role="alert" className="error-message">
            {deleteError} could not be deleted. Please try again.{" "}
            <button
              type="button"
              className="text-link"
              onClick={() => setDeleteError("")}
            >
              Dismiss
            </button>
          </p>
        )}
        {stats && (
          <div className="stats-row">
            <StatCard label="Resumes tracked" value={stats.total} />
            <StatCard label="Average coverage" value={stats.average} />
            <StatCard label="Best coverage" value={stats.best} />
          </div>
        )}
        {resumes.length > 0 && (
          <div className="collection-heading">
            <div>
              <p className="eyebrow">The review collection</p>
              <h2>Your reviews</h2>
            </div>
            <div className="toolbar">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search company or role"
                aria-label="Search resumes"
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort resumes"
                className="toolbar-select"
              >
                <option value="recent">Most recent</option>
                <option value="score-desc">Highest score</option>
                <option value="score-asc">Lowest score</option>
                <option value="company">Company A–Z</option>
              </select>
            </div>
          </div>
        )}
        {(isLoading || loadingResumes) && (
          <p className="loading-state" role="status">
            Gathering your reviews…
          </p>
        )}
        {!isLoading && !loadingResumes && visibleResumes.length > 0 && (
          <div className="resumes-section">
            {visibleResumes.map((resume) => (
              <ResumeCard
                key={resume.id}
                resume={resume}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
        {!isLoading &&
          !loadingResumes &&
          resumes.length > 0 &&
          visibleResumes.length === 0 && (
            <div className="empty-state">
              <h2>A little too specific?</h2>
              <p>No resumes match “{query}”.</p>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setQuery("")}
              >
                Clear search
              </button>
            </div>
          )}
        {!isLoading && !loadingResumes && resumes?.length === 0 && (
          <div className="empty-state">
            <span className="eyebrow clay">A fresh page</span>
            <h2>Your story starts here.</h2>
            <p>
              Pair your resume with a job description for a clear view of your
              keyword coverage and practical writing feedback.
            </p>
            <Link to="/upload" className="primary-button">
              Upload Resume <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
        <footer className="page-footer">
          <span>ResumeIQ · A considered next step</span>
          <span>
            Keyword coverage offers perspective, not a hiring prediction.
          </span>
        </footer>
      </section>
    </main>
  );
}
