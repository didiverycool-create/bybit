import type { ReviewDocument } from '../types'

type ReplayWorkspaceFocusSignalsSectionProps = {
  replayFocusReview: ReviewDocument
}

export default function ReplayWorkspaceFocusSignalsSection({ replayFocusReview }: ReplayWorkspaceFocusSignalsSectionProps) {
  return (
    <div className="replay-focus__signals">
      <div>
        <span>亮点</span>
        <ul className="replay-bullet-list">
          {replayFocusReview.highlights.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <span>风险</span>
        <ul className="replay-bullet-list replay-bullet-list--warn">
          {replayFocusReview.risks.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
