import type { CaseStudy } from "@/content/case-studies";

/**
 * A quiet index rail over the case studies, doubling as local anchor
 * navigation. Number, label and category only — no thumbnails, because a
 * thumbnail of a client interface is exactly the kind of asset this section
 * must not carry.
 */
export default function WorkIndex({ studies }: { studies: CaseStudy[] }) {
  return (
    <nav className="windex" aria-label="Case studies">
      <ol className="windex__list">
        {studies.map((study, i) => (
          <li key={study.id} className="windex__item">
            <a className="windex__link" href={`#${study.id}`}>
              <span className="windex__number">{String(i + 1).padStart(2, "0")}</span>
              <span className="windex__label">{study.title}</span>
              <span className="windex__category">{study.category}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
