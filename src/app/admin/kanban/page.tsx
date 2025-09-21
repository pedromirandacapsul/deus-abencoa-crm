'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { AnimatedDashboardContainer, AnimatedDashboardItem } from '@/components/dashboard/animated-dashboard-container'
import { ArrowLeft, Plus, Filter, Download } from 'lucide-react'
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
  sourceDetails: string | null
  createdAt: string
  lastInteractionAt: string | null
  lastInteractionType: string | null
  nextActionAt: string | null
  nextActionType: string | null
  nextActionNotes: string | null
  lossReason: string | null
  lossDetails: string | null
  owner?: {
    id: string
    name: string
    email: string
  } | null
  tagAssignments?: {
    id: string
    tag: {
      id: string
      name: string
      color: string
      category?: string
    }
  }[]
  _count?: {
    activities: number
    tasks: number
  }
}

export default function KanbanPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session) {
      fetchLeads()
    }
  }, [session])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/leads?limit=100') // Carregamos mais leads para o kanban
      const data = await response.json()

      if (data.success) {
        setLeads(data.data.leads || [])
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLeadUpdate = async (leadId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          lastInteractionAt: new Date().toISOString(),
          lastInteractionType: 'STATUS_CHANGE'
        }),
      })

      if (response.ok) {
        // Atualizar o lead local
        setLeads(prevLeads =>
          prevLeads.map(lead =>
            lead.id === leadId
              ? { ...lead, status: newStatus, lastInteractionAt: new Date().toISOString() }
              : lead
          )
        )
      }
    } catch (error) {
      console.error('Error updating lead:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  return (
    <AnimatedDashboardContainer className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-full mx-auto space-y-6">
        {/* Header */}
        <AnimatedDashboardItem>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                className="p-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Pipeline Kanban</h1>
                <p className="text-gray-600">Visualize e gerencie seu pipeline de vendas</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button onClick={() => router.push('/admin/leads/new')} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Novo Lead
              </Button>
            </div>
          </div>
        </AnimatedDashboardItem>

        {/* Estatísticas Rápidas */}
        <AnimatedDashboardItem>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Novos', count: leads.filter(l => l.status === 'NEW').length, color: 'bg-blue-500' },
              { label: 'Contatados', count: leads.filter(l => l.status === 'CONTACTED').length, color: 'bg-yellow-500' },
              { label: 'Qualificados', count: leads.filter(l => l.status === 'QUALIFIED').length, color: 'bg-purple-500' },
              { label: 'Proposta', count: leads.filter(l => l.status === 'PROPOSAL').length, color: 'bg-orange-500' },
              { label: 'Convertidos', count: leads.filter(l => l.status === 'WON').length, color: 'bg-green-500' },
            ].map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-lg p-4 border shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </AnimatedDashboardItem>

        {/* Kanban Board */}
        <AnimatedDashboardItem>
          <KanbanBoard leads={leads} onLeadUpdate={handleLeadUpdate} />
        </AnimatedDashboardItem>
      </div>
    </AnimatedDashboardContainer>
  )
}