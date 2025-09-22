'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Building,
  Clock,
  DollarSign,
  Plus,
  Search,
  Filter,
  TrendingUp,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { OpportunityStage } from '@/lib/types/opportunity'

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

interface KanbanColumn {
  id: string
  title: string
  stage: OpportunityStage
  color: string
  opportunities: Opportunity[]
}

const stageColumns: Omit<KanbanColumn, 'opportunities'>[] = [
  { id: 'new', title: 'Novos', stage: OpportunityStage.NEW, color: 'bg-blue-100 border-blue-200' },
  { id: 'qualification', title: 'Qualificação', stage: OpportunityStage.QUALIFICATION, color: 'bg-yellow-100 border-yellow-200' },
  { id: 'discovery', title: 'Descoberta', stage: OpportunityStage.DISCOVERY, color: 'bg-orange-100 border-orange-200' },
  { id: 'proposal', title: 'Proposta', stage: OpportunityStage.PROPOSAL, color: 'bg-purple-100 border-purple-200' },
  { id: 'negotiation', title: 'Negociação', stage: OpportunityStage.NEGOTIATION, color: 'bg-indigo-100 border-indigo-200' },
  { id: 'won', title: 'Ganhos', stage: OpportunityStage.WON, color: 'bg-emerald-100 border-emerald-200' },
  { id: 'lost', title: 'Perdidos', stage: OpportunityStage.LOST, color: 'bg-red-100 border-red-200' },
]

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString('pt-BR')
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

  const isOverdue = opportunity.expectedCloseAt &&
    new Date(opportunity.expectedCloseAt) < new Date() &&
    ![OpportunityStage.WON, OpportunityStage.LOST].includes(opportunity.stage)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-3"
    >
      <Card className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isOverdue ? 'border-red-300 bg-red-50' : ''
      }`}>
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-medium text-sm text-gray-900">
              {opportunity.lead.name}
            </h3>
            <div className="flex items-center space-x-1">
              {getStageIcon(opportunity.stage)}
              <div className="w-8 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xs font-medium text-blue-800">
                  {opportunity.probability}%
                </span>
              </div>
            </div>
          </div>

          {opportunity.lead.company && (
            <div className="flex items-center space-x-2 text-xs text-gray-600 mb-2">
              <Building className="h-3 w-3" />
              <span className="truncate">{opportunity.lead.company}</span>
            </div>
          )}

          <div className="space-y-2 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm font-medium text-gray-900">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span>{formatCurrency(opportunity.amountBr)}</span>
              </div>
              {opportunity.items.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {opportunity.items.length} {opportunity.items.length === 1 ? 'item' : 'itens'}
                </Badge>
              )}
            </div>

            {opportunity.expectedCloseAt && (
              <div className={`flex items-center space-x-2 text-xs ${
                isOverdue ? 'text-red-600' : 'text-gray-600'
              }`}>
                <Calendar className="h-3 w-3" />
                <span>Previsão: {formatDate(opportunity.expectedCloseAt)}</span>
                {isOverdue && <AlertTriangle className="h-3 w-3" />}
              </div>
            )}

            <div className="flex items-center space-x-2 text-xs text-gray-600">
              <Clock className="h-3 w-3" />
              <span>Criado: {formatDate(opportunity.createdAt)}</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center space-x-1">
              <User className="h-3 w-3 text-gray-400" />
              <span className="text-gray-600 truncate">{opportunity.owner.name}</span>
            </div>

            <div className="flex items-center space-x-2">
              {opportunity._count.tasks > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {opportunity._count.tasks} tarefas
                </Badge>
              )}
              {opportunity.lead.source && (
                <Badge variant="outline" className="text-xs px-1 py-0">
                  {opportunity.lead.source}
                </Badge>
              )}
            </div>
          </div>

          {opportunity.lostReason && opportunity.stage === OpportunityStage.LOST && (
            <div className="mt-2 pt-2 border-t border-red-200">
              <p className="text-xs text-red-600">
                Motivo: {opportunity.lostReason.replace('_', ' ')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KanbanColumnComponent({ column }: { column: KanbanColumn }) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  })

  const totalValue = column.opportunities.reduce((sum, opp) => sum + (opp.amountBr || 0), 0)
  const weightedValue = column.opportunities.reduce((sum, opp) =>
    sum + ((opp.amountBr || 0) * (opp.probability / 100)), 0
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 border-dashed ${column.color} p-4 min-h-[600px] transition-colors ${
        isOver ? 'ring-2 ring-blue-500 border-blue-500' : ''
      }`}
    >
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold text-gray-900">{column.title}</h2>
          <Badge variant="secondary">{column.opportunities.length}</Badge>
        </div>

        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>Total:</span>
            <span className="font-medium">{formatCurrency(totalValue)}</span>
          </div>
          {column.stage !== OpportunityStage.WON && column.stage !== OpportunityStage.LOST && (
            <div className="flex justify-between">
              <span>Ponderado:</span>
              <span className="font-medium text-blue-600">{formatCurrency(weightedValue)}</span>
            </div>
          )}
        </div>
      </div>

      <SortableContext
        items={column.opportunities.map(opp => opp.id)}
        strategy={verticalListSortingStrategy}
      >
        {column.opportunities.map((opportunity) => (
          <OpportunityCard key={opportunity.id} opportunity={opportunity} />
        ))}
      </SortableContext>

      {column.opportunities.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p>Arraste oportunidades para esta coluna</p>
        </div>
      )}
    </div>
  )
}

export default function OpportunityKanbanPage() {
  const { data: session } = useSession()
  const [columns, setColumns] = useState<KanbanColumn[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [owners, setOwners] = useState<Array<{ id: string; name: string }>>([])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const fetchOpportunities = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(ownerFilter && { owner_id: ownerFilter }),
        ...(sourceFilter && { source: sourceFilter }),
        limit: '1000', // Get all opportunities for kanban
      })

      const response = await fetch(`/api/opportunities?${params}`)
      if (response.ok) {
        const data = await response.json()
        const opportunities = data.data.opportunities

        // Group opportunities by stage
        const groupedColumns = stageColumns.map(col => ({
          ...col,
          opportunities: opportunities.filter((opp: Opportunity) => opp.stage === col.stage)
        }))

        setColumns(groupedColumns)
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
  }, [search, ownerFilter, sourceFilter])

  useEffect(() => {
    fetchOwners()
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // Find the opportunity being dragged
    let draggedOpportunity: Opportunity | null = null
    let sourceColumn: KanbanColumn | null = null

    for (const column of columns) {
      const opportunity = column.opportunities.find(o => o.id === activeId)
      if (opportunity) {
        draggedOpportunity = opportunity
        sourceColumn = column
        break
      }
    }

    if (!draggedOpportunity || !sourceColumn) return

    // Find target column
    let targetColumn: KanbanColumn | null = null
    targetColumn = columns.find(col => col.id === overId) || null

    if (!targetColumn) {
      for (const column of columns) {
        if (column.opportunities.some(o => o.id === overId)) {
          targetColumn = column
          break
        }
      }
    }

    if (!targetColumn || targetColumn.stage === sourceColumn.stage) return

    // Optimistically update UI first
    const updatedColumns = columns.map(column => {
      if (column.id === sourceColumn.id) {
        return {
          ...column,
          opportunities: column.opportunities.filter(o => o.id !== activeId)
        }
      }
      if (column.id === targetColumn.id) {
        return {
          ...column,
          opportunities: [...column.opportunities, { ...draggedOpportunity, stage: targetColumn.stage }]
        }
      }
      return column
    })
    setColumns(updatedColumns)

    // Update opportunity stage on server
    try {
      const response = await fetch(`/api/opportunities/${activeId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageTo: targetColumn.stage,
          ...(targetColumn.stage === OpportunityStage.LOST && { lostReason: 'OTHER' })
        }),
      })

      if (!response.ok) {
        // Revert on error
        setColumns(columns)
        console.error('Failed to update opportunity stage')
      }
    } catch (error) {
      // Revert on error
      setColumns(columns)
      console.error('Error updating opportunity stage:', error)
    }
  }

  const activeOpportunity = activeId ?
    columns.flatMap(col => col.opportunities).find(opp => opp.id === activeId) : null

  if (!session) return null

  const userRole = session.user.role

  // Calculate totals
  const totals = columns.reduce((acc, col) => {
    const total = col.opportunities.reduce((sum, opp) => sum + (opp.amountBr || 0), 0)
    const weighted = col.opportunities.reduce((sum, opp) =>
      sum + ((opp.amountBr || 0) * (opp.probability / 100)), 0
    )
    return {
      total: acc.total + total,
      weighted: acc.weighted + weighted,
      count: acc.count + col.opportunities.length
    }
  }, { total: 0, weighted: 0, count: 0 })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kanban - Oportunidades</h1>
          <p className="text-gray-600">
            Gerencie o pipeline de vendas arrastando oportunidades entre os estágios
          </p>
        </div>
        <div className="flex space-x-2">
          {hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_CREATE) && (
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Oportunidade
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pipeline Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.total)}</p>
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
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totals.weighted)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Oportunidades</p>
                <p className="text-2xl font-bold text-gray-900">{totals.count}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar oportunidades..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
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
                setOwnerFilter('')
                setSourceFilter('')
              }}
            >
              <Filter className="mr-2 h-4 w-4" />
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            {columns.map((column) => (
              <KanbanColumnComponent key={column.id} column={column} />
            ))}
          </div>

          <DragOverlay>
            {activeOpportunity && <OpportunityCard opportunity={activeOpportunity} />}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}