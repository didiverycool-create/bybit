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
}

export default function LazyECharts(props: LazyChartProps) {
  return <ReactEChartsCore echarts={echarts} {...props} />
}
