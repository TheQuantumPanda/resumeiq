import { useEffect, useState } from "react";
import { useCountUp } from "~/lib/useCountUp";

const ScoreCircle = ({ score = 75 }: { score: number }) => {
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const [drawn, setDrawn] = useState(false);
  const displayed = useCountUp(score);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const strokeDashoffset = circumference * (1 - (drawn ? score / 100 : 0));

  return (
    <div className="relative w-[76px] h-[76px] shrink-0">
      <svg
        height="100%"
        width="100%"
        viewBox="0 0 100 100"
        className="transform -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={normalizedRadius}
          stroke="var(--color-line)"
          strokeWidth={stroke}
          fill="transparent"
        />

        <circle
          cx="50"
          cy="50"
          r={normalizedRadius}
          stroke="var(--color-forest)"
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center shrink-0 justify-center">
        <span className="text-xs tabular-nums">{`${displayed}/100`}</span>
      </div>
    </div>
  );
};

export default ScoreCircle;
