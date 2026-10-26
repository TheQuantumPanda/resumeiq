import { useEffect, useRef, useState } from "react";
import { useCountUp } from "~/lib/useCountUp";

const ScoreGauge = ({ score = 75 }: { score: number }) => {
  const [pathLength, setPathLength] = useState(0);
  const [drawn, setDrawn] = useState(false);
  const pathRef = useRef<SVGPathElement>(null);
  const displayed = useCountUp(score);

  const percentage = drawn ? score / 100 : 0;

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative w-40 h-20">
        <svg viewBox="0 0 100 50" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M10,50 A40,40 0 0,1 90,50"
            fill="none"
            stroke="var(--color-line)"
            strokeWidth="10"
            strokeLinecap="round"
          />

          {/* Foreground arc with rounded ends */}
          <path
            ref={pathRef}
            d="M10,50 A40,40 0 0,1 90,50"
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={pathLength}
            strokeDashoffset={pathLength * (1 - percentage)}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center shrink-0 justify-center pt-2">
          <div className="text-xl font-semibold pt-4 tabular-nums">
            {displayed}/100
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreGauge;
