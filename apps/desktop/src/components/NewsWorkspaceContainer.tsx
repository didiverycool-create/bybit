import type { ComponentProps } from 'react'

import NewsWorkspaceSection from './NewsWorkspaceSection'

type NewsWorkspaceSectionProps = ComponentProps<typeof NewsWorkspaceSection>

type NewsWorkspaceContainerProps = {
  news: NewsWorkspaceSectionProps['news']
  onOpenAlertsSection: NewsWorkspaceSectionProps['onOpenAlertsSection']
}

export default function NewsWorkspaceContainer({
  news,
  onOpenAlertsSection,
}: NewsWorkspaceContainerProps) {
  return <NewsWorkspaceSection news={news} onOpenAlertsSection={onOpenAlertsSection} />
}
