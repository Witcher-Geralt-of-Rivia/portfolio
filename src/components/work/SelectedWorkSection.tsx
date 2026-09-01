import CaseStudy from "./CaseStudy";
import WorkIndex from "./WorkIndex";
import { publishableCaseStudies, sectionIsPublishable } from "@/content/case-studies";

/**
 * 05 / SELECTED WORK
 *
 * NOT WIRED INTO THE PAGE YET, and deliberately so.
 *
 * This section publishes claims about real engineering work, so it renders
 * only when at least three case studies are both marked verified and actually
 * complete. As of this writing none are: the repository holds no record of any
 * client engagement, which `docs/CASE_STUDY_SOURCE_AUDIT.md` sets out in full.
 * Until that changes, `src/app/page.tsx` keeps `#work` in its placeholder list
 * and this component is not imported.
 *
 * When verified content arrives: set the entries' `status` to `"verified"`,
 * add `"work"` to the `BUILT` set in `page.tsx`, render this component after
 * `<EngineeringLabSection />`, add `@import "../styles/work.css"` to
 * `globals.css`, and add the heading assertion to `deploy/safe-deploy.ps1`
 * per D-039.
 *
 * The guard below is the last line of defence rather than the first: nothing
 * should reach it, because the section is not mounted. It returns null instead
 * of an empty shell so that wiring this in prematurely produces an obviously
 * missing section rather than a section that looks finished and says nothing.
 */
export default function SelectedWorkSection() {
  if (!sectionIsPublishable()) return null;

  const studies = publishableCaseStudies();

  return (
    <section id="work" className="work" aria-labelledby="work-title">
      <div className="work__intro">
        <div className="work__intro-lead">
          <p className="eyebrow">05 / SELECTED WORK</p>
          <h2 id="work-title" className="work__title">
            Engineering decisions in context.
          </h2>
        </div>

        <div className="work__intro-support">
          <p className="work__lead">
            Selected systems presented through the problems, architecture
            decisions and implementation trade-offs that shaped them.
          </p>
          <p className="work__capabilities">
            PROBLEM / ARCHITECTURE / EXECUTION / TRADE-OFFS / RESULT
          </p>
        </div>
      </div>

      <WorkIndex studies={studies} />

      <div className="work__cases">
        {studies.map((study, i) => (
          <CaseStudy key={study.id} study={study} index={i} />
        ))}
      </div>
    </section>
  );
}
