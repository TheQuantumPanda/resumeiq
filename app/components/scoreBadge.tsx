interface ScoreBadgeProps {
  score: number;
}

const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score }) => {
  let badgeColor: string;
  let badgeText: string;

  if (score > 70) {
    badgeColor = "status-pill";
    badgeText = "Strong";
  } else if (score > 49) {
    badgeColor = "status-pill warning";
    badgeText = "Good Start";
  } else {
    badgeColor = "status-pill danger";
    badgeText = "Needs Work";
  }

  return (
    <div className={badgeColor}>
      <p>{badgeText}</p>
    </div>
  );
};

export default ScoreBadge;
