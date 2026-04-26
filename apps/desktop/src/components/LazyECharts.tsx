import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { BarChart, CandlestickChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([CandlestickChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer])

type LazyChartProps = {
  option: object
  style?: CSSProperties
  notMerge?: boolean
  lazyUpdate?: boolean
}

type LazyChartErrorBoundaryProps = {
  children: ReactNode
  style?: CSSProperties
}

type LazyChartErrorBoundaryState = {
  hasError: boolean
  message: string | null
}

class LazyChartErrorBoundary extends Component<
  LazyChartErrorBoundaryProps,
  LazyChartErrorBoundaryState
> {
  state: LazyChartErrorBoundaryState = { hasError: false, message: null }

  static getDerivedStateFromError(error: unknown): LazyChartErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn('LazyECharts 渲染失败', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="empty-state empty-state--inline"
          role="alert"
          style={this.props.style}
          data-testid="lazy-echarts-error"
        >
          图表加载失败{this.state.message ? `：${this.state.message}` : '，请稍后重试。'}
        </div>
      )
    }
    return this.props.children
  }
}

export default function LazyECharts(props: LazyChartProps) {
  const { lazyUpdate = true, style, ...rest } = props
  return (
    <LazyChartErrorBoundary style={style}>
      <ReactEChartsCore
        echarts={echarts}
        opts={{ renderer: 'canvas' }}
        lazyUpdate={lazyUpdate}
        style={style}
        {...rest}
      />
    </LazyChartErrorBoundary>
  )
}
