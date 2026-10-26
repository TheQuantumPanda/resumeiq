import ScoreCircle from "~/components/scoreCircle";
const categories = [
  { label: "Readability", score: 92 },
  { label: "Tone & Style", score: 88 },
  { label: "Content", score: 84 },
  { label: "Structure", score: 90 },
  { label: "Skills", score: 76 },
];
const DemoReview = () => (
  <figure className="demo-review">
    <figcaption>
      <div>
        <p className="eyebrow clay">A glimpse of your review</p>
        <h3>Frontend Engineer · Acme</h3>
        <p className="field-help">Fictional sample · AI writing quality</p>
      </div>
      <ScoreCircle score={85} />
    </figcaption>
    <div className="demo-categories">
      {categories.map(({ label, score }) => (
        <div key={label} className="demo-category">
          <span>{label}</span>
          <span className="demo-bar">
            <span style={{ width: `${score}%` }} />
          </span>
          <span>{score}</span>
        </div>
      ))}
    </div>
    <p className="demo-note">
      Specific observations. Useful suggestions.
      <br />A fresh perspective on the experience you already have.
    </p>
  </figure>
);
export default DemoReview;
