'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Download,
  RefreshCw,
  Clock,
  Activity,
  PieChart,
  LineChart,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Calendar,
  Filter,
  BarChart3,
} from 'lucide-react'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Cell,
  LineChart as RechartsLineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658']

interface PerformanceData {
  period: { from: string; to: string }
  totals: {
    totalOpportunities: number
    totalValue: number
    wonOpportunities: number
    wonValue: number
    lostOpportunities: number
    lostValue: number
    activeOpportunities: number
    activeValue: number
    avgDealSize: number
    conversionRate: number
  }
  byOwner: Array<{
    ownerId: string
    ownerName: string
    totalOpportunities: number
    totalValue: number
    wonOpportunities: number
    wonValue: number
    conversionRate: number
    avgDealSize: number
  }>
}

interface PipelineData {
  period: { from: string; to: string }
  totals: {
    totalOpportunities: number
    totalValue: number
    totalWeightedValue: number
    avgDealSize: number
  }
  pipeline: Array<{
    stage: string
    count: number
    totalValue: number
    weightedValue: number
    avgDealSize: number
    probability: number
  }>
  velocity: Array<{
    stage: string
    avgDays: number
  }>
  conversionRates: Array<{
    stage: string
    entered: number
    converted: number
    conversionRate: number
  }>
}

interface ForecastData {
  period: { window: number; endDate: string }
  summary: {
    bestCase: number
    worstCase: number
    mostLikely: number
    commitForecast: number
    totalOpportunities: number
    confidence: {
      bestCase: number
      mostLikely: number
      commitForecast: number
      worstCase: number
    }
  }
  byStage: Array<{
    stage: string
    count: number
    totalValue: number
    weightedValue: number
  }>
  byOwner: Array<{
    ownerId: string
    ownerName: string
    count: number
    totalValue: number
    weightedValue: number
    commitValue: number
  }>
  byMonth: Array<{
    month: string
    count: number
    totalValue: number
    weightedValue: number
    commitValue: number
  }>
}

export default function OpportunityAnalyticsPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('30')
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null)
  const [pipelineData, setPipelineData] = useState<PipelineData | null>(null)
  const [forecastData, setForecastData] = useState<ForecastData | null>(null)

  const fetchPerformanceData = async () => {
    try {
      const days = parseInt(timeframe)
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      const to = new Date().toISOString()

      const response = await fetch(`/api/analytics/opportunities/performance?from=${from}&to=${to}`)
      if (response.ok) {
        const data = await response.json()
        setPerformanceData(data.data)
      }
    } catch (error) {
      console.error('Error fetching performance data:', error)
    }
  }

  const fetchPipelineData = async () => {
    try {
      const days = parseInt(timeframe)
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      const to = new Date().toISOString()

      const response = await fetch(`/api/analytics/opportunities/pipeline?from=${from}&to=${to}`)
      if (response.ok) {
        const data = await response.json()
        setPipelineData(data.data)
      }
    } catch (error) {
      console.error('Error fetching pipeline data:', error)
    }
  }

  const fetchForecastData = async () => {
    try {
      const response = await fetch(`/api/analytics/opportunities/forecast?window=${timeframe}`)
      if (response.ok) {
        const data = await response.json()
        setForecastData(data.data)
      }
    } catch (error) {
      console.error('Error fetching forecast data:', error)
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchPerformanceData(),
        fetchPipelineData(),
        fetchForecastData(),
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [timeframe])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (!session) return null

  const userRole = session.user.role

  if (!hasPermission(userRole, PERMISSIONS.ANALYTICS_VIEW)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Acesso Negado</h2>
          <p className="text-gray-600">Você não tem permissão para visualizar analytics de oportunidades.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics - Oportunidades</h1>
          <p className="text-gray-600">
            Análise detalhada do pipeline de vendas e performance das oportunidades
          </p>
        </div>
        <div className="flex space-x-2">
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 6 meses</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAllData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="analysis">Análise</TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {performanceData && (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <DollarSign className="h-8 w-8 text-green-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Pipeline Total</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(performanceData.totals.totalValue)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <CheckCircle className="h-8 w-8 text-emerald-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Vendas Fechadas</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(performanceData.totals.wonValue)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <Target className="h-8 w-8 text-blue-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Taxa de Conversão</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatPercent(performanceData.totals.conversionRate)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <BarChart3 className="h-8 w-8 text-purple-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Ticket Médio</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(performanceData.totals.avgDealSize)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Performance by Owner */}
                <Card>
                  <CardHeader>
                    <CardTitle>Performance por Vendedor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {performanceData.byOwner.map((owner, index) => (
                        <div key={owner.ownerId} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{owner.ownerName}</h3>
                            <div className="grid grid-cols-4 gap-4 mt-2 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Pipeline:</span> {formatCurrency(owner.totalValue)}
                              </div>
                              <div>
                                <span className="font-medium">Fechadas:</span> {formatCurrency(owner.wonValue)}
                              </div>
                              <div>
                                <span className="font-medium">Conversão:</span> {formatPercent(owner.conversionRate)}
                              </div>
                              <div>
                                <span className="font-medium">Ticket Médio:</span> {formatCurrency(owner.avgDealSize)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">{owner.totalOpportunities}</p>
                            <p className="text-sm text-gray-600">oportunidades</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-6">
            {pipelineData && (
              <>
                {/* Pipeline Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <DollarSign className="h-8 w-8 text-green-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Total Pipeline</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(pipelineData.totals.totalValue)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <TrendingUp className="h-8 w-8 text-blue-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Valor Ponderado</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {formatCurrency(pipelineData.totals.totalWeightedValue)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center">
                        <Activity className="h-8 w-8 text-purple-600" />
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-600">Oportunidades Ativas</p>
                          <p className="text-2xl font-bold text-gray-900">
                            {pipelineData.totals.totalOpportunities}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Pipeline by Stage */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pipeline por Etapa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={pipelineData.pipeline}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="stage" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip
                          formatter={(value, name) => [
                            name === 'count' ? value : formatCurrency(Number(value)),
                            name === 'count' ? 'Quantidade' : name === 'totalValue' ? 'Valor Total' : 'Valor Ponderado'
                          ]}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Quantidade" />
                        <Bar yAxisId="right" dataKey="totalValue" fill="#82ca9d" name="Valor Total" />
                        <Bar yAxisId="right" dataKey="weightedValue" fill="#ffc658" name="Valor Ponderado" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Stage Velocity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Velocidade por Etapa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {pipelineData.velocity.map((stage, index) => (
                        <div key={stage.stage} className="text-center p-4 border rounded-lg">
                          <h3 className="font-medium text-gray-900 mb-2">{stage.stage}</h3>
                          <p className="text-2xl font-bold text-blue-600">{stage.avgDays.toFixed(0)}</p>
                          <p className="text-sm text-gray-600">dias médios</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Forecast Tab */}
          <TabsContent value="forecast" className="space-y-6">
            {forecastData && (
              <>
                {/* Forecast Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">Melhor Cenário</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(forecastData.summary.bestCase)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {forecastData.summary.confidence.bestCase}% confiança
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">Mais Provável</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatCurrency(forecastData.summary.mostLikely)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {forecastData.summary.confidence.mostLikely}% confiança
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">Commit</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {formatCurrency(forecastData.summary.commitForecast)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {forecastData.summary.confidence.commitForecast}% confiança
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-600">Conservador</p>
                        <p className="text-2xl font-bold text-gray-600">
                          {formatCurrency(forecastData.summary.worstCase)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {forecastData.summary.confidence.worstCase}% confiança
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Forecast by Owner */}
                <Card>
                  <CardHeader>
                    <CardTitle>Forecast por Vendedor</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {forecastData.byOwner.map((owner) => (
                        <div key={owner.ownerId} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <h3 className="font-medium text-gray-900">{owner.ownerName}</h3>
                            <div className="grid grid-cols-3 gap-4 mt-2 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Pipeline:</span> {formatCurrency(owner.totalValue)}
                              </div>
                              <div>
                                <span className="font-medium">Ponderado:</span> {formatCurrency(owner.weightedValue)}
                              </div>
                              <div>
                                <span className="font-medium">Commit:</span> {formatCurrency(owner.commitValue)}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">{owner.count}</p>
                            <p className="text-sm text-gray-600">oportunidades</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Insights e Recomendações</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="font-medium text-blue-900 mb-2">💡 Insights Principais</h3>
                    <ul className="space-y-2 text-sm text-blue-800">
                      <li>• Análise detalhada disponível após implementação dos endpoints de analytics</li>
                      <li>• Métricas de performance e conversão em tempo real</li>
                      <li>• Previsões baseadas em dados históricos e probabilidades</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-medium text-green-900 mb-2">📈 Oportunidades de Melhoria</h3>
                    <ul className="space-y-2 text-sm text-green-800">
                      <li>• Otimização do pipeline de vendas baseada em dados</li>
                      <li>• Identificação de gargalos por etapa</li>
                      <li>• Melhoria da acurácia do forecast</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h3 className="font-medium text-yellow-900 mb-2">⚠️ Ações Recomendadas</h3>
                    <ul className="space-y-2 text-sm text-yellow-800">
                      <li>• Revisar oportunidades em atraso</li>
                      <li>• Treinar vendedores com baixa conversão</li>
                      <li>• Implementar automações para follow-up</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}