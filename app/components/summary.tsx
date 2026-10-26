import ScoreGauge from "~/components/scoreGauge";
import ScoreBadge from "~/components/scoreBadge";

const Category = ({ title, score }: { title: string; score: number }) => (
  <div className="quality-category">
    <div>
      <span>{title}</span>
      <ScoreBadge score={score} />
    </div>
    <span className="tabular-nums">{score}/100</span>
  </div>
);

const Summary = ({ feedback }: { feedback: Feedback }) => {
  return (
    <div className="panel quality-panel">
      <div className="quality-heading">
        <ScoreGauge
          score={Math.round(
            (feedback.toneAndStyle.score +
              feedback.content.score +
              feedback.structure.score +
              feedback.skills.score) /
              4,
          )}
        />

        <div>
          <h2>AI Writing Quality Estimate</h2>
          <p>
            Rounded average of Tone & Style, Content, Structure and Skills.
            Readability and keyword coverage are excluded.
          </p>
        </div>
      </div>

      <div className="quality-categories">
        <Category title="Tone & Style" score={feedback.toneAndStyle.score} />
        <Category title="Content" score={feedback.content.score} />
        <Category title="Structure" score={feedback.structure.score} />
        <Category title="Skills" score={feedback.skills.score} />
      </div>
    </div>
  );
};
export default Summary;
