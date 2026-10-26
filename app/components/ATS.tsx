interface Suggestion {
  type: "good" | "improve";
  tip: string;
}
interface ATSProps {
  score: number;
  suggestions: Suggestion[];
}
const ATS = ({ score, suggestions }: ATSProps) => (
  <section
    className="panel readability-panel"
    aria-labelledby="readability-heading"
  >
    <p className="eyebrow">AI feedback · extracted text</p>
    <div className="readability-heading">
      <h2 id="readability-heading">AI Readability Estimate</h2>
      <span className="readability-score">
        {score}
        <span className="field-help">/100</span>
      </span>
    </div>
    <p>
      An AI opinion on extracted-text readability and organization. Visual PDF
      formatting is not assessed. This is not an employer ATS score and does not
      predict acceptance.
    </p>
    <ul className="readability-tips">
      {suggestions.map((suggestion, index) => (
        <li key={index}>
          <span
            className={`tip-marker ${suggestion.type === "improve" ? "improve" : ""}`}
            aria-hidden="true"
          >
            {suggestion.type === "good" ? "✓" : "↗"}
          </span>
          <span>{suggestion.tip}</span>
        </li>
      ))}
    </ul>
    <p>Keep only changes supported by your experience.</p>
  </section>
);
export default ATS;
