/**
 * Four principles as a compact strip. Number and title only: no paragraphs,
 * no cards. Server-rendered.
 */

const PRINCIPLES = [
  { index: "01", title: "Explicit orchestration" },
  { index: "02", title: "Human control" },
  { index: "03", title: "Recoverable workflows" },
  { index: "04", title: "Observable execution" },
];

export default function EngineeringPrinciples() {
  return (
    <ul className="systems__principles">
      {PRINCIPLES.map((principle) => (
        <li key={principle.index} className="systems__principle">
          <span className="systems__principle-index">{principle.index}</span>
          <span className="systems__principle-title">{principle.title}</span>
        </li>
      ))}
    </ul>
  );
}
