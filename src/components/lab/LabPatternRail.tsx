import { PATTERN_RAIL } from "./lab-experiments";

/**
 * The six engineering patterns the lab is about, as a compact rail. Number
 * and title only, the same strip language as the Stage 05 and Stage 07
 * principles. Server-rendered.
 */
export default function LabPatternRail() {
  return (
    <div className="lab__patterns">
      <p className="lab__patterns-title">ENGINEERING PATTERNS</p>
      <ul className="lab__pattern-list">
        {PATTERN_RAIL.map((pattern) => (
          <li key={pattern.index} className="lab__pattern">
            <span className="lab__pattern-index">{pattern.index}</span>
            <span className="lab__pattern-title">{pattern.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
