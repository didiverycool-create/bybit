import type { AppOverlayPanelsContainerProps } from './AppOverlayPanelsContainer.types'
import AppOverlayPanelsHost from './AppOverlayPanelsHost'
import { buildAppOverlayPanelsControlHostProps } from './buildAppOverlayPanelsControlHostProps'
import { buildAppOverlayPanelsReviewStrategyHostProps } from './buildAppOverlayPanelsReviewStrategyHostProps'
import { buildAppOverlayPanelsTradingAccountHostProps } from './buildAppOverlayPanelsTradingAccountHostProps'

export default function AppOverlayPanelsContainer(props: AppOverlayPanelsContainerProps) {
  return (
    <AppOverlayPanelsHost
      {...buildAppOverlayPanelsControlHostProps(props)}
      {...buildAppOverlayPanelsTradingAccountHostProps(props)}
      {...buildAppOverlayPanelsReviewStrategyHostProps(props)}
    />
  )
}
