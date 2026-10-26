import {
  Accordion,
  AccordionContent,
  AccordionHeader,
  AccordionItem,
} from "./accordion";

const CategoryContent = ({
  tips,
}: {
  tips: { type: "good" | "improve"; tip: string; explanation: string }[];
}) => (
  <div className="tip-list">
    {tips.map((tip, index) => (
      <div
        key={index + tip.tip}
        className={`tip-detail ${tip.type === "improve" ? "improve" : ""}`}
      >
        <span className="tip-label">
          {tip.type === "good" ? "Working well" : "Room to refine"}
        </span>
        <h3>{tip.tip}</h3>
        <p>{tip.explanation}</p>
      </div>
    ))}
  </div>
);
const Details = ({ feedback }: { feedback: Feedback }) => (
  <section
    className="panel analysis-details"
    aria-label="Detailed AI writing suggestions"
  >
    <Accordion>
      <AccordionItem id="tone-style">
        <AccordionHeader itemId="tone-style">
          <span className="category-header">
            <span>Tone & Style</span>
            <span className="category-number">
              {feedback.toneAndStyle.score}/100
            </span>
          </span>
        </AccordionHeader>
        <AccordionContent itemId="tone-style">
          <CategoryContent tips={feedback.toneAndStyle.tips} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem id="content">
        <AccordionHeader itemId="content">
          <span className="category-header">
            <span>Content</span>
            <span className="category-number">
              {feedback.content.score}/100
            </span>
          </span>
        </AccordionHeader>
        <AccordionContent itemId="content">
          <CategoryContent tips={feedback.content.tips} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem id="structure">
        <AccordionHeader itemId="structure">
          <span className="category-header">
            <span>Structure</span>
            <span className="category-number">
              {feedback.structure.score}/100
            </span>
          </span>
        </AccordionHeader>
        <AccordionContent itemId="structure">
          <CategoryContent tips={feedback.structure.tips} />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem id="skills">
        <AccordionHeader itemId="skills">
          <span className="category-header">
            <span>Skills</span>
            <span className="category-number">{feedback.skills.score}/100</span>
          </span>
        </AccordionHeader>
        <AccordionContent itemId="skills">
          <CategoryContent tips={feedback.skills.tips} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </section>
);
export default Details;
