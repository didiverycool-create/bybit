import type { CSSProperties } from 'react'
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

export default function LazyECharts(props: LazyChartProps) {
  const { lazyUpdate = true, ...rest } = props
  return <ReactEChartsCore echarts={echarts} opts={{ renderer: 'canvas' }} lazyUpdate={lazyUpdate} {...rest} />
}
