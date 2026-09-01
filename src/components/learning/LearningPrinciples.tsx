import { PRINCIPLES } from "./learning-scenarios";

/**
 * Four principles as a compact strip — number and title only, the same visual
 * language as the Stage 05 engineering principles. Server-rendered.
 */
export default function LearningPrinciples() {
  return (
    <ul className="learning__principles">
      {PRINCIPLES.map((principle) => (
        <li key={principle.index} className="learning__principle">
          <span className="learning__principle-index">{principle.index}</span>
          <span className="learning__principle-title">{principle.title}</span>
        </li>
      ))}
    </ul>
  );
}
