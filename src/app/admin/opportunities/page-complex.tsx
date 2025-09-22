'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  TrendingUp,
  Calendar,
  User,
  Building,
  FileText,
  Download,
  Kanban,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { OpportunityStage } from '@/lib/types/opportunity'
import Link from 'next/link'

interface Opportunity {
  id: string
  stage: OpportunityStage
  amountBr: number | null
  probability: number
  expectedCloseAt: string | null
  createdAt: string
  closedAt: string | null
  lostReason: string | null
  lead: {
    id: string
    name: string
    company: string | null
    source: string | null
    email: string | null
    phone: string | null
  }
  owner: {
    id: string
    name: string
    email: string
  }
  items: Array<{
    id: string
    productName: string
    qty: number
    unitPriceBr: number
    subtotalBr: number
  }>
  _count: {
    tasks: number
  }
}

const stageLabels = {
  [OpportunityStage.NEW]: 'Novo',
  [OpportunityStage.QUALIFICATION]: 'Qualificação',
  [OpportunityStage.DISCOVERY]: 'Descoberta',
  [OpportunityStage.PROPOSAL]: 'Proposta',
  [OpportunityStage.NEGOTIATION]: 'Negociação',
  [OpportunityStage.WON]: 'Ganha',
  [OpportunityStage.LOST]: 'Perdida',
}

const stageColors = {
  [OpportunityStage.NEW]: 'bg-blue-100 text-blue-800',
  [OpportunityStage.QUALIFICATION]: 'bg-yellow-100 text-yellow-800',
  [OpportunityStage.DISCOVERY]: 'bg-orange-100 text-orange-800',
  [OpportunityStage.PROPOSAL]: 'bg-purple-100 text-purple-800',
  [OpportunityStage.NEGOTIATION]: 'bg-indigo-100 text-indigo-800',
  [OpportunityStage.WON]: 'bg-emerald-100 text-emerald-800',
  [OpportunityStage.LOST]: 'bg-red-100 text-red-800',
}

export default function OpportunitiesPage() {
  const { data: session } = useSession()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([])
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([])

  const fetchOpportunities = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(search && { search }),
        ...(stageFilter && { stage: stageFilter }),
        ...(ownerFilter && { owner_id: ownerFilter }),
        ...(sourceFilter && { source: sourceFilter }),
      })

      const response = await fetch(`/api/opportunities?${params}`)
      if (response.ok) {
        const data = await response.json()
        setOpportunities(data.data.opportunities)
        setTotalPages(data.data.pagination.totalPages)
        setTotalCount(data.data.pagination.total)
      }
    } catch (error) {
      console.error('Error fetching opportunities:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOwners = async () => {
    try {
      const response = await fetch('/api/users?role=SALES,MANAGER,ADMIN&active=true')
      if (response.ok) {
        const data = await response.json()
        setOwners(data.data.users.map((user: any) => ({ id: user.id, name: user.name })))
      }
    } catch (error) {
      console.error('Error fetching owners:', error)
    }
  }

  useEffect(() => {
    fetchOpportunities()
  }, [currentPage, search, stageFilter, ownerFilter, sourceFilter])

  useEffect(() => {
    fetchOwners()
  }, [])

  const handleDeleteOpportunity = async (id: string) => {
    try {
      const response = await fetch(`/api/opportunities/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setOpportunities(opportunities.filter(opp => opp.id !== id))
      } else {
        console.error('Failed to delete opportunity')
      }
    } catch (error) {
      console.error('Error deleting opportunity:', error)
    }
  }

  const handleBulkExport = async () => {
    try {
      const response = await fetch('/api/opportunities/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_export',
          opportunityIds: selectedOpportunities.length > 0 ? selectedOpportunities : opportunities.map(o => o.id),
          format: 'csv',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        // Convert to CSV and download
        const csvContent = convertToCSV(data.data.exportData)
        downloadCSV(csvContent, 'oportunidades.csv')
      }
    } catch (error) {
      console.error('Error exporting opportunities:', error)
    }
  }

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return ''

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header]
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value
      }).join(','))
    ].join('\n')

    return csvContent
  }

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatCurrency = (value: number | null) => {
    if (!value) return 'R$ 0'
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  const isOverdue = (expectedCloseAt: string | null, stage: OpportunityStage) => {
    return expectedCloseAt &&
      new Date(expectedCloseAt) < new Date() &&
      ![OpportunityStage.WON, OpportunityStage.LOST].includes(stage)
  }

  const getStageIcon = (stage: OpportunityStage) => {
    switch (stage) {
      case OpportunityStage.WON:
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case OpportunityStage.LOST:
        return <XCircle className="h-4 w-4 text-red-600" />
      case OpportunityStage.NEGOTIATION:
        return <TrendingUp className="h-4 w-4 text-indigo-600" />
      default:
        return null
    }
  }

  if (!session) return null

  const userRole = session.user.role

  // Calculate summary statistics
  const summaryStats = {
    total: opportunities.reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
    weighted: opportunities.reduce((sum, opp) => sum + ((opp.amountBr || 0) * (opp.probability / 100)), 0),
    won: opportunities.filter(opp => opp.stage === OpportunityStage.WON).reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
    overdue: opportunities.filter(opp => isOverdue(opp.expectedCloseAt, opp.stage)).length,
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Oportunidades</h1>
          <p className="text-gray-600">
            Gerencie seu pipeline de vendas e acompanhe o progresso dos negócios
          </p>
        </div>
        <div className="flex space-x-2">
          <Link href="/admin/opportunities/kanban">
            <Button variant="outline">
              <Kanban className="mr-2 h-4 w-4" />
              Kanban
            </Button>
          </Link>
          {hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_CREATE) && (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Oportunidade
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pipeline Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.total)}</p>
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
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.weighted)}</p>
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
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(summaryStats.won)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Em Atraso</p>
                <p className="text-2xl font-bold text-gray-900">{summaryStats.overdue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">Filtros</CardTitle>
            <div className="flex space-x-2">
              {selectedOpportunities.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setSelectedOpportunities([])}>
                    Limpar Seleção ({selectedOpportunities.length})
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBulkExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Selecionados
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={handleBulkExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Todos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar oportunidades..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={stageFilter || 'all'} onValueChange={(value) => setStageFilter(value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Estágio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Estágios</SelectItem>
                {Object.entries(stageLabels).map(([stage, label]) => (
                  <SelectItem key={stage} value={stage}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ownerFilter || 'all'} onValueChange={(value) => setOwnerFilter(value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Responsáveis</SelectItem>
                {owners.map(owner => (
                  <SelectItem key={owner.id} value={owner.id}>
                    {owner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sourceFilter || 'all'} onValueChange={(value) => setSourceFilter(value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Origens</SelectItem>
                <SelectItem value="Website">Website</SelectItem>
                <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                <SelectItem value="Referral">Indicação</SelectItem>
                <SelectItem value="Google">Google</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                setSearch('')
                setStageFilter('')
                setOwnerFilter('')
                setSourceFilter('')
                setCurrentPage(1)
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedOpportunities.length === opportunities.length && opportunities.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOpportunities(opportunities.map(o => o.id))
                        } else {
                          setSelectedOpportunities([])
                        }
                      }}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Lead / Empresa</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Probabilidade</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((opportunity) => (
                  <TableRow
                    key={opportunity.id}
                    className={isOverdue(opportunity.expectedCloseAt, opportunity.stage) ? 'bg-red-50' : ''}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedOpportunities.includes(opportunity.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOpportunities([...selectedOpportunities, opportunity.id])
                          } else {
                            setSelectedOpportunities(selectedOpportunities.filter(id => id !== opportunity.id))
                          }
                        }}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{opportunity.lead.name}</p>
                        {opportunity.lead.company && (
                          <p className="text-sm text-gray-600">{opportunity.lead.company}</p>
                        )}
                        {opportunity.items.length > 0 && (
                          <div className="flex items-center space-x-1 mt-1">
                            <FileText className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {opportunity.items.length} {opportunity.items.length === 1 ? 'item' : 'itens'}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStageIcon(opportunity.stage)}
                        <Badge variant="secondary" className={stageColors[opportunity.stage]}>
                          {stageLabels[opportunity.stage]}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrency(opportunity.amountBr)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-12 h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-blue-600 rounded-full"
                            style={{ width: `${opportunity.probability}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">{opportunity.probability}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{opportunity.owner.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <span className="text-sm">{formatDate(opportunity.expectedCloseAt)}</span>
                        {isOverdue(opportunity.expectedCloseAt, opportunity.stage) && (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">{formatDate(opportunity.createdAt)}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            Visualizar
                          </DropdownMenuItem>
                          {hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_UPDATE) && (
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_DELETE) && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (window.confirm('Tem certeza que deseja excluir esta oportunidade? Esta ação não pode ser desfeita.')) {
                                  handleDeleteOpportunity(opportunity.id)
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!loading && opportunities.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhuma oportunidade encontrada</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Mostrando {(currentPage - 1) * 20 + 1} a {Math.min(currentPage * 20, totalCount)} de {totalCount} oportunidades
          </p>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Próximo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}