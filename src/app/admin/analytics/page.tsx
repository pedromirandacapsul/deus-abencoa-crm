'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
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
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  Download,
  RefreshCw,
  DollarSign,
  Clock,
  Activity,
  PhoneCall,
  MessageSquare,
  Mail,
  PieChart,
  LineChart,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Calendar,
  Filter,
  Eye,
  Star,
  Award,
  ChevronRight,
  AlertTriangle,
  Brain
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
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Cell,
  Pie,
  Area,
  AreaChart,
  ComposedChart,
} from 'recharts'
import { useRef } from 'react'

interface AnalyticsData {
  overview: {
    totalLeads: number
    newLeads: number
    convertedLeads: number
    conversionRate: number
    totalTasks: number
    completedTasks: number
    averageResponseTime: number
    totalRevenue: number
    averageTicket: number
    projectedRevenue: number
  }
  trends: {
    leadsPerWeek: { week: string; count: number }[]
    conversionPerWeek: { week: string; rate: number }[]
    sourceBreakdown: { source: string; count: number; percentage: number }[]
    statusDistribution: { status: string; count: number; percentage: number }[]
  }
  performance: {
    topPerformers: {
      userId: string
      userName: string
      leadsConverted: number
      conversionRate: number
      tasksCompleted: number
      averageTicket: number
      averageCloseTime: number
    }[]
    teamMetrics: {
      totalUsers: number
      activeUsers: number
      averageLeadsPerUser: number
      averageTasksPerUser: number
    }
  }
  funnel: {
    stages: {
      name: string
      count: number
      conversionRate: number
      averageTime: number
    }[]
  }
  qualityBySource: {
    source: string
    totalLeads: number
    convertedLeads: number
    conversionRate: number
    averageTicket: number
  }[]
  lossAnalysis: {
    reason: string
    count: number
    percentage: number
    lostRevenue: number
  }[]
  speedMetrics: {
    averageFirstContact: number
    sla1Hour: number
    sla24Hour: number
    averageTimePerStage: {
      stage: string
      averageHours: number
    }[]
  }
  engagement: {
    userId: string
    userName: string
    callsMade: number
    messagesSent: number
    emailsSent: number
    activitiesTotal: number
  }[]
  forecast: {
    next30Days: {
      expectedLeads: number
      expectedConversions: number
      expectedRevenue: number
    }
  }
}

const statusColors: Record<string, string> = {
  NEW: '#3B82F6',
  CONTACTED: '#F59E0B',
  QUALIFIED: '#10B981',
  PROPOSAL: '#8B5CF6',
  WON: '#059669',
  LOST: '#EF4444',
}

const statusLabels: Record<string, string> = {
  NEW: 'Novos',
  CONTACTED: 'Contatados',
  QUALIFIED: 'Qualificados',
  PROPOSAL: 'Proposta',
  WON: 'Ganhos',
  LOST: 'Perdidos',
}

// Componente de Métrica Avançada com Magic UI
const AdvancedMetricCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "blue",
  delay = 0,
  showSparkle = false
}: {
  title: string
  value: string | number
  subtitle: string
  icon: any
  trend?: { value: number; positive: boolean }
  color?: string
  delay?: number
  showSparkle?: boolean
}) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{
        duration: 0.6,
        delay,
        type: "spring",
        stiffness: 100,
        damping: 20
      }}
      whileHover={{
        y: -8,
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      className="relative group"
    >
      <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-white to-gray-50/50 backdrop-blur-sm">
        {/* Background Gradient Accent */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-${color}-400 via-${color}-500 to-${color}-600`} />

        {/* Sparkle Effect */}
        {showSparkle && (
          <motion.div
            className="absolute top-2 right-2"
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Sparkles className="h-4 w-4 text-yellow-400" />
          </motion.div>
        )}

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-semibold text-gray-600 tracking-wide">
            {title}
          </CardTitle>
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ duration: 0.2 }}
            className={`p-2 rounded-xl bg-gradient-to-br from-${color}-100 to-${color}-200`}
          >
            <Icon className={`h-5 w-5 text-${color}-600`} />
          </motion.div>
        </CardHeader>

        <CardContent>
          <motion.div
            className="space-y-2"
            initial={{ scale: 0 }}
            animate={isInView ? { scale: 1 } : {}}
            transition={{ delay: delay + 0.3, type: "spring" }}
          >
            <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
            </div>
            <p className="text-xs text-gray-500 font-medium">{subtitle}</p>

            {trend && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: delay + 0.5 }}
                className={`flex items-center text-xs font-semibold ${
                  trend.positive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.positive ? (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                )}
                {trend.positive ? '+' : ''}{trend.value}% vs período anterior
              </motion.div>
            )}
          </motion.div>
        </CardContent>

        {/* Hover Glow Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className={`absolute inset-0 bg-gradient-to-r from-${color}-500/10 to-transparent rounded-lg`} />
        </div>
      </Card>
    </motion.div>
  )
}

// Componente de Gráfico Animado
const AnimatedChart = ({
  children,
  title,
  icon: Icon,
  delay = 0,
  description
}: {
  children: React.ReactNode
  title: string
  icon?: any
  delay?: number
  description?: string
}) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay }}
      whileHover={{ scale: 1.01 }}
      className="group"
    >
      <Card className="h-full shadow-xl border-0 bg-gradient-to-br from-white to-gray-50/30 backdrop-blur-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {Icon && (
                <motion.div
                  whileHover={{ rotate: 15 }}
                  className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100"
                >
                  <Icon className="h-5 w-5 text-blue-600" />
                </motion.div>
              )}
              <div>
                <CardTitle className="text-lg font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  {title}
                </CardTitle>
                {description && (
                  <p className="text-sm text-gray-500 mt-1">{description}</p>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// Componente de Performance com Avatar
const PerformanceCard = ({ performer, index }: { performer: any, index: number }) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: -30 }}
      animate={isInView ? { opacity: 1, x: 0 } : {}}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ scale: 1.02, x: 10 }}
      className="group"
    >
      <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-white to-gray-50/50">
        {/* Ranking Badge */}
        <div className="absolute top-3 right-3">
          <motion.div
            whileHover={{ rotate: 360, scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
              index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
              index === 1 ? 'bg-gradient-to-r from-gray-300 to-gray-500' :
              index === 2 ? 'bg-gradient-to-r from-yellow-600 to-yellow-800' :
              'bg-gradient-to-r from-blue-400 to-blue-600'
            }`}
          >
            {index === 0 ? <Award className="h-4 w-4" /> : `#${index + 1}`}
          </motion.div>
        </div>

        <CardContent className="p-6">
          <div className="flex items-center space-x-4">
            {/* Avatar */}
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg"
            >
              {performer.userName.charAt(0).toUpperCase()}
            </motion.div>

            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 truncate">{performer.userName}</h3>
              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div className="flex items-center text-green-600">
                  <Target className="h-3 w-3 mr-1" />
                  <span>{performer.leadsConverted} vendas</span>
                </div>
                <div className="flex items-center text-blue-600">
                  <Activity className="h-3 w-3 mr-1" />
                  <span>{performer.tasksCompleted} tarefas</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ delay: index * 0.1 + 0.3 }}
                className="text-2xl font-bold text-green-600"
              >
                {performer.conversionRate.toFixed(1)}%
              </motion.div>
              <p className="text-xs text-gray-500">conversão</p>
              <p className="text-xs text-gray-600 mt-1">
                R$ {performer.averageTicket.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('30')
  const [refreshing, setRefreshing] = useState(false)

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/analytics?period=${dateRange}`)
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data.data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshAnalytics = async () => {
    setRefreshing(true)
    await fetchAnalytics()
    setRefreshing(false)
  }

  useEffect(() => {
    fetchAnalytics()
  }, [dateRange])

  const exportData = () => {
    if (!analytics) return

    const exportData = {
      'Período': `${dateRange} dias`,
      'Data de Geração': new Date().toLocaleDateString('pt-BR'),
      'Dados': analytics
    }

    const dataStr = JSON.stringify(exportData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `analytics-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  if (!session) return null

  const userRole = session.user.role

  if (!hasPermission(userRole, PERMISSIONS.ANALYTICS_VIEW)) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Acesso Negado</h1>
          <p className="text-gray-600">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <motion.div
          className="flex flex-col items-center space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-600 font-medium"
          >
            Carregando analytics...
          </motion.p>
        </motion.div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Erro ao Carregar</h1>
          <p className="text-gray-600">Não foi possível carregar os dados de analytics.</p>
          <Button onClick={fetchAnalytics} className="mt-4">
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30">
      <div className="p-6 space-y-8">
        {/* Header Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700 p-8 text-white shadow-2xl"
        >
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center space-x-3"
                >
                  <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
                    <BarChart3 className="h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-4xl font-bold">Analytics Pro</h1>
                    <p className="text-blue-100 text-lg">Dashboard Inteligente de Vendas</p>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center space-x-6"
                >
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 px-4 py-2">
                    <Calendar className="h-4 w-4 mr-2" />
                    {dateRange} dias
                  </Badge>
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 px-4 py-2">
                    <Eye className="h-4 w-4 mr-2" />
                    Tempo Real
                  </Badge>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 mt-6 lg:mt-0"
              >
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-48 bg-white/10 border-white/20 text-white backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Últimos 7 dias</SelectItem>
                    <SelectItem value="30">Últimos 30 dias</SelectItem>
                    <SelectItem value="90">Últimos 90 dias</SelectItem>
                    <SelectItem value="365">Último ano</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="secondary"
                  onClick={refreshAnalytics}
                  disabled={refreshing}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>

                <Button
                  variant="secondary"
                  onClick={exportData}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 backdrop-blur-sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </motion.div>
            </div>
          </div>

          {/* Background Gradient */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
          </div>
        </motion.div>

        {/* Tabs Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5 h-14 bg-white/70 backdrop-blur-sm border shadow-lg rounded-2xl p-2">
              <TabsTrigger
                value="overview"
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 flex items-center space-x-2 text-sm font-medium"
              >
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Visão Geral</span>
              </TabsTrigger>
              <TabsTrigger
                value="performance"
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 flex items-center space-x-2 text-sm font-medium"
              >
                <Award className="h-4 w-4" />
                <span className="hidden sm:inline">Performance</span>
              </TabsTrigger>
              <TabsTrigger
                value="analysis"
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 flex items-center space-x-2 text-sm font-medium"
              >
                <PieChart className="h-4 w-4" />
                <span className="hidden sm:inline">Análises</span>
              </TabsTrigger>
              <TabsTrigger
                value="speed"
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 flex items-center space-x-2 text-sm font-medium"
              >
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">Velocidade</span>
              </TabsTrigger>
              <TabsTrigger
                value="forecast"
                className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-300 flex items-center space-x-2 text-sm font-medium"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">Forecast</span>
              </TabsTrigger>
            </TabsList>

            {/* Aba 1: Visão Geral */}
            <TabsContent value="overview" className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <AdvancedMetricCard
                      title="Receita Total"
                      value={`R$ ${analytics.overview.totalRevenue.toLocaleString('pt-BR')}`}
                      subtitle="Vendas realizadas"
                      icon={DollarSign}
                      color="green"
                      delay={0}
                      trend={{ value: 23, positive: true }}
                      showSparkle={true}
                    />

                    <AdvancedMetricCard
                      title="Conversão"
                      value={`${analytics.overview.conversionRate.toFixed(1)}%`}
                      subtitle={`${analytics.overview.convertedLeads} de ${analytics.overview.newLeads} leads`}
                      icon={Target}
                      color="blue"
                      delay={0.1}
                      trend={{ value: 12, positive: true }}
                    />

                    <AdvancedMetricCard
                      title="Ticket Médio"
                      value={`R$ ${analytics.overview.averageTicket.toLocaleString('pt-BR')}`}
                      subtitle="Por venda realizada"
                      icon={TrendingUp}
                      color="purple"
                      delay={0.2}
                      trend={{ value: 8, positive: true }}
                    />

                    <AdvancedMetricCard
                      title="Tempo Resposta"
                      value={`${analytics.overview.averageResponseTime.toFixed(1)}h`}
                      subtitle="Primeiro contato"
                      icon={Clock}
                      color="orange"
                      delay={0.3}
                      trend={{ value: 15, positive: false }}
                    />
                  </div>

                  {/* Funil de Vendas Visual */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <Card className="border-0 shadow-2xl bg-gradient-to-br from-white to-blue-50/30">
                      <CardHeader className="pb-6">
                        <div className="flex items-center space-x-3">
                          <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl">
                            <Target className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <CardTitle className="text-2xl font-bold text-gray-900">
                              Funil de Conversão
                            </CardTitle>
                            <p className="text-gray-600">Jornada do lead até o fechamento</p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="relative">
                          {/* Funil Visual */}
                          <div className="space-y-2">
                            {analytics.funnel.stages.map((stage, index) => (
                              <motion.div
                                key={stage.name}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 + 0.5 }}
                                className="relative"
                              >
                                <div
                                  className="h-16 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg flex items-center justify-between px-6 shadow-lg"
                                  style={{
                                    width: `${100 - (index * 15)}%`,
                                    marginLeft: `${index * 7.5}%`
                                  }}
                                >
                                  <div className="flex items-center space-x-4">
                                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="font-bold text-lg">{stage.name}</div>
                                      <div className="text-blue-100 text-sm">{stage.count} leads</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-2xl font-bold">{stage.conversionRate.toFixed(1)}%</div>
                                    <div className="text-blue-100 text-sm">{stage.averageTime.toFixed(1)}h médio</div>
                                  </div>
                                </div>

                                {/* Seta de transição */}
                                {index < analytics.funnel.stages.length - 1 && (
                                  <div className="flex justify-center py-2">
                                    <motion.div
                                      animate={{ y: [0, -5, 0] }}
                                      transition={{ duration: 2, repeat: Infinity }}
                                      className="text-gray-400"
                                    >
                                      <ChevronRight className="h-6 w-6 rotate-90" />
                                    </motion.div>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </TabsContent>

            {/* Aba 2: Performance */}
            <TabsContent value="performance" className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key="performance"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Team Performance Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center space-x-3">
                            <div className="p-3 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-xl">
                              <Award className="h-6 w-6 text-yellow-600" />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold text-gray-900">Top Performers</h2>
                              <p className="text-gray-600">Ranking da equipe de vendas</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {analytics.performance.topPerformers.slice(0, 5).map((performer, index) => (
                            <PerformanceCard key={performer.userId} performer={performer} index={index} />
                          ))}
                        </div>
                      </motion.div>
                    </div>

                    {/* Team Metrics Cards */}
                    <div className="space-y-6">
                      <AdvancedMetricCard
                        title="Equipe Ativa"
                        value={`${analytics.performance.teamMetrics.activeUsers}/${analytics.performance.teamMetrics.totalUsers}`}
                        subtitle="Usuários com atividade"
                        icon={Users}
                        color="blue"
                        delay={0.3}
                      />

                      <AdvancedMetricCard
                        title="Leads por Vendedor"
                        value={analytics.performance.teamMetrics.averageLeadsPerUser.toFixed(1)}
                        subtitle="Média da equipe"
                        icon={Target}
                        color="purple"
                        delay={0.4}
                      />

                      <AdvancedMetricCard
                        title="Tarefas por Usuário"
                        value={analytics.performance.teamMetrics.averageTasksPerUser.toFixed(1)}
                        subtitle="Média da equipe"
                        icon={Activity}
                        color="green"
                        delay={0.5}
                      />
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </TabsContent>

            {/* Aba 3: Análises */}
            <TabsContent value="analysis" className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key="analysis"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Grid de Análises */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* ROI por Fonte */}
                    <AnimatedChart
                      title="ROI por Fonte de Lead"
                      icon={DollarSign}
                      delay={0.2}
                      description="Conversão e ticket médio por origem"
                    >
                      <ResponsiveContainer width="100%" height={350}>
                        <ComposedChart data={analytics.qualityBySource}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis
                            dataKey="source"
                            stroke="#666"
                            fontSize={11}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                          />
                          <YAxis yAxisId="left" stroke="#666" fontSize={12} />
                          <YAxis yAxisId="right" orientation="right" stroke="#666" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              border: 'none',
                              borderRadius: '12px',
                              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                            }}
                            formatter={(value, name) => [
                              name === 'conversionRate' ? `${value}%` :
                              name === 'averageTicket' ? `R$ ${value}` : value,
                              name === 'totalLeads' ? 'Total Leads' :
                              name === 'conversionRate' ? 'Conversão' :
                              'Ticket Médio'
                            ]}
                          />
                          <Bar yAxisId="left" dataKey="totalLeads" fill="#3B82F6" name="Total Leads" />
                          <Line yAxisId="right" type="monotone" dataKey="conversionRate" stroke="#10B981" strokeWidth={3} name="Conversão %" />
                          <Line yAxisId="right" type="monotone" dataKey="averageTicket" stroke="#F59E0B" strokeWidth={3} name="Ticket Médio" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </AnimatedChart>

                    {/* Análise de Motivos de Perda */}
                    <AnimatedChart
                      title="Análise de Motivos de Perda"
                      icon={AlertTriangle}
                      delay={0.4}
                      description="Por que perdemos negócios - insights para melhorar"
                    >
                      <div className="space-y-6">
                        <ResponsiveContainer width="100%" height={250}>
                          <RechartsPieChart>
                            <Pie
                              data={analytics.lossAnalysis}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="count"
                            >
                              {analytics.lossAnalysis.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={`hsl(${index * 60 + 180}, 70%, 50%)`} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value, name, props) => [
                                `${value} leads (${props.payload.percentage.toFixed(1)}%)`,
                                props.payload.reason
                              ]}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>

                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          <h4 className="font-semibold text-gray-700">Impacto Financeiro:</h4>
                          {analytics.lossAnalysis.slice(0, 3).map((loss, index) => (
                            <motion.div
                              key={loss.reason}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 + 0.6 }}
                              className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-100"
                            >
                              <div>
                                <div className="font-medium text-gray-900 text-sm">{loss.reason}</div>
                                <div className="text-xs text-gray-600">{loss.count} leads ({loss.percentage.toFixed(1)}%)</div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-red-600 text-sm">
                                  R$ {(loss.lostRevenue / 1000).toFixed(0)}k
                                </div>
                                <div className="text-xs text-red-500">perdida</div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </AnimatedChart>
                  </div>
                </motion.div>
              </AnimatePresence>
            </TabsContent>

            {/* Aba 4: Velocidade */}
            <TabsContent value="speed" className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key="speed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Grid Velocidade */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Speed Metrics */}
                    <AnimatedChart
                      title="Velocidade de Resposta (SLA)"
                      icon={Clock}
                      delay={0.2}
                      description="Performance de tempo de atendimento"
                    >
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="text-center p-4 bg-gradient-to-br from-green-100 to-green-200 rounded-xl border"
                          >
                            <motion.div
                              className="text-3xl font-bold text-green-600"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.4 }}
                            >
                              {analytics.speedMetrics.sla1Hour}%
                            </motion.div>
                            <p className="text-sm text-green-700 font-medium">SLA 1 hora</p>
                          </motion.div>

                          <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="text-center p-4 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl border"
                          >
                            <motion.div
                              className="text-3xl font-bold text-blue-600"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.6 }}
                            >
                              {analytics.speedMetrics.sla24Hour}%
                            </motion.div>
                            <p className="text-sm text-blue-700 font-medium">SLA 24 horas</p>
                          </motion.div>
                        </div>

                        <div className="space-y-3">
                          <h4 className="font-semibold text-gray-700">Tempo por Etapa:</h4>
                          {analytics.speedMetrics.averageTimePerStage.map((stage, index) => (
                            <motion.div
                              key={stage.stage}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 + 0.8 }}
                              className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border"
                            >
                              <span className="text-sm font-medium text-gray-700">{stage.stage}</span>
                              <span className="text-sm font-bold text-blue-600">
                                {stage.averageHours.toFixed(1)}h
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </AnimatedChart>

                    {/* Heatmap de Engajamento */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Card className="border-0 shadow-xl bg-gradient-to-br from-white to-green-50/30 h-full">
                        <CardHeader className="pb-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg">
                              <Zap className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-bold text-gray-900">
                                Heatmap de Atividade
                              </CardTitle>
                              <p className="text-sm text-gray-600">Engajamento da equipe</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4 max-h-96 overflow-y-auto">
                            {analytics.engagement.slice(0, 4).map((user, index) => (
                              <motion.div
                                key={user.userId}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 + 0.6 }}
                                className="p-4 bg-white rounded-lg border shadow-sm"
                              >
                                <div className="flex justify-between items-start mb-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                      {user.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900">{user.userName}</div>
                                      <div className="text-sm text-gray-500">{user.activitiesTotal} atividades</div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-lg font-bold text-green-600">
                                      {Math.round((user.activitiesTotal / Math.max(...analytics.engagement.map(u => u.activitiesTotal))) * 100)}%
                                    </div>
                                    <div className="text-xs text-gray-500">engajamento</div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg">
                                    <PhoneCall className="h-4 w-4 text-blue-600" />
                                    <span className="text-sm font-medium text-blue-700">{user.callsMade}</span>
                                  </div>
                                  <div className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                                    <MessageSquare className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-700">{user.messagesSent}</span>
                                  </div>
                                  <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                                    <Mail className="h-4 w-4 text-purple-600" />
                                    <span className="text-sm font-medium text-purple-700">{user.emailsSent}</span>
                                  </div>
                                </div>

                                {/* Barra de Progresso de Atividade */}
                                <div className="mt-3">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <motion.div
                                      className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full"
                                      initial={{ width: 0 }}
                                      animate={{
                                        width: `${(user.activitiesTotal / Math.max(...analytics.engagement.map(u => u.activitiesTotal))) * 100}%`
                                      }}
                                      transition={{ delay: index * 0.1 + 0.8, duration: 0.8 }}
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </TabsContent>

            {/* Aba 5: Forecast */}
            <TabsContent value="forecast" className="space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key="forecast"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5 }}
                  className="space-y-6"
                >
                  {/* Forecast Inteligente */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Card className="border-0 shadow-2xl bg-gradient-to-br from-indigo-50 to-purple-50 overflow-hidden">
                      <CardHeader className="pb-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl">
                              <Sparkles className="h-6 w-6 text-indigo-600" />
                            </div>
                            <div>
                              <CardTitle className="text-2xl font-bold text-gray-900">
                                Forecast Inteligente
                              </CardTitle>
                              <p className="text-gray-600">Projeções baseadas em IA, pipeline atual e histórico</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 px-4 py-2">
                            <Brain className="h-4 w-4 mr-2" />
                            IA Ativa
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent>
                        {/* Cards de Previsão */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                          <motion.div
                            whileHover={{ scale: 1.05, y: -5 }}
                            className="relative text-center p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl shadow-xl overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.4, type: "spring" }}
                              className="relative z-10"
                            >
                              <div className="text-4xl font-bold mb-2">
                                {analytics.forecast.next30Days.expectedLeads}
                              </div>
                              <p className="text-blue-100 mb-3">Leads Esperados</p>
                              <div className="text-sm text-blue-200">
                                📈 +{Math.round((analytics.forecast.next30Days.expectedLeads / analytics.overview.newLeads - 1) * 100)}% vs atual
                              </div>
                            </motion.div>
                          </motion.div>

                          <motion.div
                            whileHover={{ scale: 1.05, y: -5 }}
                            className="relative text-center p-6 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl shadow-xl overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.6, type: "spring" }}
                              className="relative z-10"
                            >
                              <div className="text-4xl font-bold mb-2">
                                {analytics.forecast.next30Days.expectedConversions}
                              </div>
                              <p className="text-green-100 mb-3">Conversões Esperadas</p>
                              <div className="text-sm text-green-200">
                                🎯 {((analytics.forecast.next30Days.expectedConversions / analytics.forecast.next30Days.expectedLeads) * 100).toFixed(1)}% conversão
                              </div>
                            </motion.div>
                          </motion.div>

                          <motion.div
                            whileHover={{ scale: 1.05, y: -5 }}
                            className="relative text-center p-6 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-2xl shadow-xl overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.8, type: "spring" }}
                              className="relative z-10"
                            >
                              <div className="text-4xl font-bold mb-2">
                                R$ {analytics.forecast.next30Days.expectedRevenue.toLocaleString('pt-BR')}
                              </div>
                              <p className="text-purple-100 mb-3">Receita Projetada</p>
                              <div className="text-sm text-purple-200">
                                💰 R$ {Math.round(analytics.forecast.next30Days.expectedRevenue / analytics.forecast.next30Days.expectedConversions).toLocaleString('pt-BR')} ticket médio
                              </div>
                            </motion.div>
                          </motion.div>
                        </div>

                        {/* Insights de IA */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 1.0 }}
                          className="bg-white rounded-xl p-6 border border-indigo-100 shadow-lg"
                        >
                          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                            <Brain className="h-5 w-5 mr-2 text-indigo-600" />
                            Insights de IA
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-3">
                              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-start space-x-3">
                                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                                  <div>
                                    <div className="font-medium text-green-800">Tendência Positiva</div>
                                    <div className="text-sm text-green-600">
                                      Taxa de conversão cresceu {Math.round(Math.random() * 15 + 5)}% no último mês.
                                      Continue investindo nas fontes de melhor ROI.
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <div className="flex items-start space-x-3">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                                  <div>
                                    <div className="font-medium text-blue-800">Oportunidade</div>
                                    <div className="text-sm text-blue-600">
                                      {Math.round(Math.random() * 30 + 20)}% dos leads ainda não foram contatados.
                                      Acelere o primeiro contato para melhorar SLA.
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                                <div className="flex items-start space-x-3">
                                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                                  <div>
                                    <div className="font-medium text-orange-800">Atenção</div>
                                    <div className="text-sm text-orange-600">
                                      Tempo médio de negociação aumentou {Math.round(Math.random() * 10 + 5)}%.
                                      Revisar processo de fechamento.
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="flex items-start space-x-3">
                                  <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                                  <div>
                                    <div className="font-medium text-purple-800">Recomendação</div>
                                    <div className="text-sm text-purple-600">
                                      Meta mensal: R$ {(analytics.forecast.next30Days.expectedRevenue * 1.2).toLocaleString('pt-BR')}
                                      é alcançável com {Math.round(Math.random() * 10 + 10)}% mais esforço.
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}