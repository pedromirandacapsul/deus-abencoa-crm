'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Search,
  Filter,
  Download,
  Plus,
  Eye,
  Phone,
  Mail,
  Building,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  roleTitle: string | null
  status: string
  score: number
  source: string | null
  createdAt: string
  owner?: {
    id: string
    name: string
    email: string
  } | null
  _count?: {
    activities: number
    tasks: number
  }
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-green-100 text-green-800',
  PROPOSAL: 'bg-purple-100 text-purple-800',
  WON: 'bg-emerald-100 text-emerald-800',
  LOST: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  NEW: 'Novo',
  CONTACTED: 'Contatado',
  QUALIFIED: 'Qualificado',
  PROPOSAL: 'Proposta',
  WON: 'Ganho',
  LOST: 'Perdido',
}

export default function LeadsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
      })

      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/leads?${params}`)

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`)
      }

      const data = await response.json()

      if (data.success) {
        setLeads(data.data.leads)
        setTotalPages(data.data.pagination.totalPages)
      } else {
        setError(data.error || 'Erro ao carregar leads')
      }
    } catch (err) {
      console.error('Error fetching leads:', err)
      setError('Erro ao carregar leads. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeads()
  }, [currentPage, searchTerm, statusFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setCurrentPage(1)
    fetchLeads()
  }

  const handleNewLead = () => {
    router.push('/admin/leads/new')
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/leads/export')
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `leads-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Error exporting leads:', error)
    }
  }

  const handleCall = (lead: Lead) => {
    if (lead.phone) {
      window.open(`tel:${lead.phone}`)
    }
  }

  const handleEmail = (lead: Lead) => {
    if (lead.email) {
      window.open(`mailto:${lead.email}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-red-800 font-medium">Erro ao carregar dados</h3>
          <p className="text-red-600">{error}</p>
          <Button onClick={fetchLeads} className="mt-2">
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-600">Gerencie todos os seus leads</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={handleNewLead}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total de Leads</p>
                <p className="text-2xl font-bold text-gray-900">{leads.length}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Building className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Novos</p>
                <p className="text-2xl font-bold text-blue-600">
                  {leads.filter(l => l.status === 'NEW').length}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Plus className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Qualificados</p>
                <p className="text-2xl font-bold text-green-600">
                  {leads.filter(l => l.status === 'QUALIFIED').length}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <MessageCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Convertidos</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {leads.filter(l => l.status === 'WON').length}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg">
                <Eye className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <form onSubmit={handleSearch} className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="search"
                  placeholder="Buscar por nome, email, empresa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </form>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os status</SelectItem>
                <SelectItem value="NEW">Novo</SelectItem>
                <SelectItem value="CONTACTED">Contatado</SelectItem>
                <SelectItem value="QUALIFIED">Qualificado</SelectItem>
                <SelectItem value="PROPOSAL">Proposta</SelectItem>
                <SelectItem value="WON">Ganho</SelectItem>
                <SelectItem value="LOST">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{lead.name}</p>
                        <p className="text-sm text-gray-600">{lead.company}</p>
                        {lead.roleTitle && (
                          <p className="text-xs text-gray-500">{lead.roleTitle}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="flex items-center space-x-1 text-sm">
                            <Mail className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-600">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center space-x-1 text-sm">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span className="text-gray-600">{lead.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[lead.status] || 'bg-gray-100 text-gray-800'}>
                        {statusLabels[lead.status] || lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <span className="font-medium">{lead.score}</span>
                        <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${Math.min(lead.score, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">{lead.source || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-600">
                        {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/admin/leads/${lead.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCall(lead)}
                          disabled={!lead.phone}
                          title={lead.phone ? `Ligar para ${lead.phone}` : 'Telefone não disponível'}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEmail(lead)}
                          disabled={!lead.email}
                          title={lead.email ? `Enviar email para ${lead.email}` : 'Email não disponível'}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}