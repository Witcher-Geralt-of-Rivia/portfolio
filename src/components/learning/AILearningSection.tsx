import LearningLab from "./LearningLab";
import LearningPrinciples from "./LearningPrinciples";

/**
 * 03 / AI LEARNING SYSTEMS
 *
 * Where Stage 05 showed how a system executes and Stage 06 showed one product
 * across its surfaces, this section shows a system that changes its own next
 * move: learner context, a knowledge model, an activity, an assessment and the
 * feedback that reorders what comes next.
 *
 * Server-rendered apart from the lab, which is the only interactive part.
 */
export default function AILearningSection() {
  return (
    <section id="ai-learning" className="learning" aria-labelledby="ai-learning-title">
      <div className="learning__intro">
        <div className="learning__intro-lead">
          <p className="eyebrow">03 / AI LEARNING SYSTEMS</p>
          <h2 id="ai-learning-title" className="learning__title">
            Learning paths that adapt.
          </h2>
        </div>

        <div className="learning__intro-support">
          <p className="learning__lead">
            Adaptive learning experiences that connect learner context,
            knowledge gaps, content, assessment and feedback into one
            continuous system.
          </p>
          <p className="learning__capabilities">
            ADAPTIVE LEARNING / RAG / ASSESSMENT / FEEDBACK / ANALYTICS
          </p>
        </div>
      </div>

      <div className="learning__lab">
        <LearningLab />
      </div>

      <LearningPrinciples />
    </section>
  );
}
