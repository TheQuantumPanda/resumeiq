import { BRAND } from "~/lib/brand";
import { usePuterStore } from "~/lib/puter";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import DemoReview from "~/components/demoReview";

export const meta = () => [
  { title: `${BRAND.name} | Sign in` },
  { name: "description", content: "Log into your account" },
];

const features = [
  "Explainable keyword coverage",
  "Scored against the real posting",
  "Saved reviews and reruns",
];

const Auth = () => {
  const { isLoading, auth, error } = usePuterStore();
  const location = useLocation();
  const requested = new URLSearchParams(location.search).get("next");
  const next =
    requested?.startsWith("/") &&
    !requested.startsWith("//") &&
    !requested.includes("\\")
      ? requested
      : "/";
  const navigate = useNavigate();

  useEffect(() => {
    if (auth.isAuthenticated) navigate(next || "/");
  }, [auth.isAuthenticated, next]);

  return (
    <main>
      <header className="auth-header">
        <Link to="/" className="brand" aria-label={`${BRAND.name} home`}>
          <span className="brand-mark" aria-hidden="true">
            RI
          </span>
          <div>
            <p className="wordmark">{BRAND.name}</p>
            <p className="brand-note">A considered next step</p>
          </div>
        </Link>
        <p className="eyebrow">
          Thoughtful preparation. Clearer possibilities.
        </p>
      </header>
      <div className="auth-layout">
        <section className="auth-story">
          <p className="eyebrow clay">Your career, thoughtfully considered</p>
          <h1>
            Your experience,
            <br />
            <em>well presented.</em>
          </h1>
          <p className="lede">
            A little perspective can make a meaningful difference. Understand
            how your resume meets a role, and find the words to tell your story
            more clearly.
          </p>
          <ol className="auth-features">
            {features.map((feature, index) => (
              <li key={feature}>
                <span aria-hidden="true">0{index + 1}</span>
                {feature}
              </li>
            ))}
          </ol>
        </section>
        <aside className="auth-aside">
          <section
            className="panel auth-panel"
            aria-labelledby="welcome-heading"
          >
            <p className="eyebrow">Welcome to ResumeIQ</p>
            <h2 id="welcome-heading">
              {auth.isAuthenticated
                ? "You're signed in"
                : "Make your next move a considered one."}
            </h2>
            <p className="lede">
              {auth.isAuthenticated
                ? `Signed in as ${auth.user?.username ?? "your account"}.`
                : "Sign in with Puter to begin your resume review. Your workspace will be here when you return."}
            </p>
            {error && (
              <p role="alert" className="error-message">
                {error}
              </p>
            )}
            {isLoading ? (
              <button className="auth-button" disabled>
                Connecting to Puter…
              </button>
            ) : auth.isAuthenticated ? (
              <>
                <Link to="/" className="primary-button">
                  Go to dashboard <span aria-hidden="true">→</span>
                </Link>
                <button className="nav-link" onClick={auth.signOut}>
                  Log out
                </button>
              </>
            ) : (
              <button className="auth-button" onClick={auth.signIn}>
                Log In <span aria-hidden="true">→</span>
              </button>
            )}
            <p className="auth-privacy">
              Puter handles sign-in and stores your resumes in your own account.
              AI usage is subject to your Puter allowance and charges.
            </p>
          </section>
          <DemoReview />
        </aside>
      </div>
      <footer className="auth-footer">
        An estimate, a fresh perspective, and a practical place to start. Never
        a promise of selection.
      </footer>
    </main>
  );
};
export default Auth;
