import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { OpportunityStage, LossReason } from '@/lib/types/opportunity'
import { OpportunityValidationService } from '@/lib/services/opportunity-validation'
import { OpportunityAutomationService } from '@/lib/services/opportunity-automation'
import { z } from 'zod'

const bulkUpdateSchema = z.object({
  opportunityIds: z.array(z.string()).min(1, 'Pelo menos uma oportunidade deve ser selecionada'),
  action: z.enum(['update_stage', 'assign_owner', 'update_probability', 'delete']),
  data: z.object({
    stage: z.nativeEnum(OpportunityStage).optional(),
    ownerId: z.string().optional(),
    probability: z.number().min(0).max(100).optional(),
    lostReason: z.nativeEnum(LossReason).optional(),
  }).optional(),
})

const bulkAssignSchema = z.object({
  leadIds: z.array(z.string()).min(1, 'Pelo menos um lead deve ser selecionado'),
  ownerId: z.string().min(1, 'ID do responsável é obrigatório'),
  stage: z.nativeEnum(OpportunityStage).default(OpportunityStage.NEW),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const userRole = session.user.role
    const body = await request.json()
    const action = body.action

    switch (action) {
      case 'bulk_update':
        return await handleBulkUpdate(body, session, userRole)
      case 'bulk_assign':
        return await handleBulkAssign(body, session, userRole)
      case 'bulk_export':
        return await handleBulkExport(body, session, userRole)
      default:
        return NextResponse.json(
          { success: false, error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in bulk operations:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function handleBulkUpdate(body: any, session: any, userRole: string) {
  if (!hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_UPDATE)) {
    return NextResponse.json(
      { success: false, error: 'Sem permissão para atualizar oportunidades' },
      { status: 403 }
    )
  }

  const validatedData = bulkUpdateSchema.parse(body)
  const { opportunityIds, action, data } = validatedData

  // Validate bulk operation
  const validation = await OpportunityValidationService.validateBulkUpdate(
    opportunityIds,
    data || {}
  )

  if (!validation.isValid) {
    return NextResponse.json(
      { success: false, error: validation.errors.join(', ') },
      { status: 400 }
    )
  }

  // Get opportunities to update
  const opportunities = await prisma.opportunity.findMany({
    where: {
      id: { in: opportunityIds },
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
        },
      },
      lead: {
        select: {
          name: true,
          company: true,
        },
      },
    },
  })

  // Check permissions for each opportunity
  if (userRole === 'SALES') {
    const unauthorizedOpps = opportunities.filter(opp => opp.ownerId !== session.user.id)
    if (unauthorizedOpps.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para modificar algumas oportunidades' },
        { status: 403 }
      )
    }
  }

  const results = []
  const errors = []

  // Process each opportunity
  for (const opportunity of opportunities) {
    try {
      let updateData: any = {}
      let shouldCreateHistory = false

      switch (action) {
        case 'update_stage':
          if (data?.stage) {
            updateData.stage = data.stage
            shouldCreateHistory = true

            // Set stage-specific data
            if (data.stage === OpportunityStage.LOST && data.lostReason) {
              updateData.lostReason = data.lostReason
            }
            if (data.stage === OpportunityStage.WON) {
              updateData.closedAt = new Date()
            }

            // Auto-update probability based on stage
            const stageProbability = await prisma.stageProbability.findUnique({
              where: { stage: data.stage },
            })
            if (stageProbability) {
              updateData.probability = stageProbability.probability
            }
          }
          break

        case 'assign_owner':
          if (data?.ownerId) {
            updateData.ownerId = data.ownerId
          }
          break

        case 'update_probability':
          if (data?.probability !== undefined) {
            updateData.probability = data.probability
          }
          break

        case 'delete':
          // Only allow deletion of early stage opportunities
          if (!['NEW', 'QUALIFICATION'].includes(opportunity.stage)) {
            errors.push(`${opportunity.lead.name}: Apenas oportunidades em estágio inicial podem ser excluídas`)
            continue
          }
          break
      }

      if (action === 'delete') {
        await prisma.opportunity.delete({
          where: { id: opportunity.id },
        })
      } else {
        const updatedOpportunity = await prisma.$transaction(async (tx) => {
          const updated = await tx.opportunity.update({
            where: { id: opportunity.id },
            data: updateData,
          })

          // Create stage history if stage changed
          if (shouldCreateHistory && data?.stage && data.stage !== opportunity.stage) {
            await tx.stageHistory.create({
              data: {
                opportunityId: opportunity.id,
                stageFrom: opportunity.stage,
                stageTo: data.stage,
                changedBy: session.user.id,
              },
            })

            // Execute automations
            await OpportunityAutomationService.executeStageChangeAutomations({
              opportunityId: opportunity.id,
              stageFrom: opportunity.stage as OpportunityStage,
              stageTo: data.stage,
              userId: session.user.id,
              userRole: userRole as any,
              amountBr: updated.amountBr || undefined,
            })
          }

          return updated
        })

        results.push({
          id: opportunity.id,
          leadName: opportunity.lead.name,
          company: opportunity.lead.company,
          success: true,
        })
      }
    } catch (error) {
      console.error(`Error updating opportunity ${opportunity.id}:`, error)
      errors.push(`${opportunity.lead.name}: Erro ao atualizar`)
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      processed: results.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      warnings: validation.warnings,
    },
    message: `${results.length} oportunidades processadas com sucesso`,
  })
}

async function handleBulkAssign(body: any, session: any, userRole: string) {
  if (!hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_CREATE)) {
    return NextResponse.json(
      { success: false, error: 'Sem permissão para criar oportunidades' },
      { status: 403 }
    )
  }

  const validatedData = bulkAssignSchema.parse(body)
  const { leadIds, ownerId, stage } = validatedData

  // Validate owner exists and is active
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { role: true, isActive: true },
  })

  if (!owner || !owner.isActive) {
    return NextResponse.json(
      { success: false, error: 'Usuário responsável não encontrado ou inativo' },
      { status: 400 }
    )
  }

  // Get leads
  const leads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
    },
    include: {
      opportunities: {
        where: {
          stage: {
            notIn: [OpportunityStage.WON, OpportunityStage.LOST],
          },
        },
      },
    },
  })

  const results = []
  const errors = []
  const warnings = []

  for (const lead of leads) {
    try {
      // Check if lead already has active opportunities
      if (lead.opportunities.length > 0) {
        warnings.push(`${lead.name}: Lead já possui oportunidades ativas`)
      }

      // Create opportunity
      const opportunity = await prisma.opportunity.create({
        data: {
          leadId: lead.id,
          ownerId,
          stage,
          probability: stage === OpportunityStage.NEW ? 10 : 20,
        },
        include: {
          lead: {
            select: {
              name: true,
              company: true,
            },
          },
        },
      })

      // Execute automations for new opportunity
      await OpportunityAutomationService.executeStageChangeAutomations({
        opportunityId: opportunity.id,
        stageTo: stage,
        userId: session.user.id,
        userRole: userRole as any,
      })

      results.push({
        opportunityId: opportunity.id,
        leadName: lead.name,
        company: lead.company,
        success: true,
      })
    } catch (error) {
      console.error(`Error creating opportunity for lead ${lead.id}:`, error)
      errors.push(`${lead.name}: Erro ao criar oportunidade`)
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      processed: leadIds.length,
      successful: results.length,
      failed: errors.length,
      results,
      errors,
      warnings,
    },
    message: `${results.length} oportunidades criadas com sucesso`,
  })
}

async function handleBulkExport(body: any, session: any, userRole: string) {
  if (!hasPermission(userRole, PERMISSIONS.ANALYTICS_EXPORT)) {
    return NextResponse.json(
      { success: false, error: 'Sem permissão para exportar dados' },
      { status: 403 }
    )
  }

  const { opportunityIds, format = 'csv' } = body

  if (!opportunityIds || opportunityIds.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Nenhuma oportunidade selecionada' },
      { status: 400 }
    )
  }

  // Build where clause
  const where: any = {
    id: { in: opportunityIds },
  }

  // Sales users can only export their own opportunities
  if (userRole === 'SALES') {
    where.ownerId = session.user.id
  }

  // Get opportunities with all related data
  const opportunities = await prisma.opportunity.findMany({
    where,
    include: {
      lead: {
        select: {
          name: true,
          email: true,
          phone: true,
          company: true,
          source: true,
          roleTitle: true,
        },
      },
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
      items: true,
    },
    orderBy: [
      { stage: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  // Format data for export
  const exportData = opportunities.map(opp => ({
    'ID': opp.id,
    'Lead': opp.lead.name,
    'Email': opp.lead.email,
    'Telefone': opp.lead.phone,
    'Empresa': opp.lead.company,
    'Cargo': opp.lead.roleTitle,
    'Fonte': opp.lead.source,
    'Responsável': opp.owner.name,
    'Email Responsável': opp.owner.email,
    'Etapa': opp.stage,
    'Valor (R$)': opp.amountBr?.toLocaleString('pt-BR') || '',
    'Probabilidade (%)': opp.probability,
    'Data Criação': opp.createdAt.toISOString().split('T')[0],
    'Data Esperada': opp.expectedCloseAt?.toISOString().split('T')[0] || '',
    'Data Fechamento': opp.closedAt?.toISOString().split('T')[0] || '',
    'Motivo Perda': opp.lostReason || '',
    'Qtd Itens': opp.items.length,
    'Valor Itens (R$)': opp.items.reduce((sum, item) => sum + item.subtotalBr, 0).toLocaleString('pt-BR'),
  }))

  return NextResponse.json({
    success: true,
    data: {
      format,
      count: exportData.length,
      exportData,
    },
    message: `${exportData.length} oportunidades preparadas para export`,
  })
}