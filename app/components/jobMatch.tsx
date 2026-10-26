import type { MatchResult } from "~/lib/matching";

export default function JobMatch({ match }: { match: MatchResult }) {
  return (
    <section className="panel match-panel" aria-labelledby="match-heading">
      <p className="eyebrow">DETERMINISTIC · KEYWORD COVERAGE</p>
      <h2 id="match-heading">Resume Compatibility Estimate</h2>
      <div className="match-value">
        <strong>{match.score === null ? "—" : `${match.score}%`}</strong>
        <p>
          {match.matched.length} of {match.terms.length} detected{" "}
          {match.method === "skills" ? "skills" : "keywords"} found in your
          resume.
          <br />
          <span className="formula">
            {match.terms.length
              ? `round(${match.matched.length} ÷ ${match.terms.length} × 100)`
              : "No useful terms detected; no score calculated."}
          </span>
        </p>
      </div>
      {match.terms.length > 0 && (
        <progress
          aria-label="Keyword coverage"
          value={match.score ?? 0}
          max={100}
        />
      )}
      <div className="term-columns">
        <div>
          <h3>Matched terms</h3>
          <div className="term-list">
            {match.matched.length ? (
              match.matched.map((term) => (
                <span key={term} className="term matched">
                  {term}
                </span>
              ))
            ) : (
              <p className="field-help">No matching terms detected.</p>
            )}
          </div>
        </div>
        <div>
          <h3>Potentially missing terms</h3>
          <div className="term-list">
            {match.missing.length ? (
              match.missing.map((term) => (
                <span key={term} className="term missing">
                  {term}
                </span>
              ))
            ) : (
              <p className="field-help">
                No missing terms among those detected.
              </p>
            )}
          </div>
        </div>
      </div>
      <p className="notice">
        {match.method === "skills"
          ? "Uses a small skills vocabulary with whole-term matching and a few aliases."
          : "No catalogued skills detected, so this uses up to 25 non-boilerplate words, ranked by frequency."}{" "}
        Each unique term counts once. Keyword presence does not establish
        proficiency, context or job suitability. Only add terms that truthfully
        describe your experience.
      </p>
    </section>
  );
}
