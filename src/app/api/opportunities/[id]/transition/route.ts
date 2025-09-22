import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { OpportunityStage, LossReason, StageRequirements, canTransitionToStage } from '@/lib/types/opportunity'
import { syncLeadWithOpportunity } from '@/lib/services/lead-opportunity-integration'
import { z } from 'zod'

const transitionStageSchema = z.object({
  stageTo: z.nativeEnum(OpportunityStage),
  lostReason: z.nativeEnum(LossReason).optional(),
  amountBr: z.number().positive().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const userRole = session.user.role
    if (!hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_UPDATE)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para alterar etapas de oportunidades' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = transitionStageSchema.parse(body)

    // Get current opportunity
    const { id } = await params
    const currentOpportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            name: true,
            company: true,
          },
        },
      },
    })

    if (!currentOpportunity) {
      return NextResponse.json(
        { success: false, error: 'Oportunidade não encontrada' },
        { status: 404 }
      )
    }

    // Role-based access control
    if (userRole === 'SALES' && currentOpportunity.ownerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para alterar esta oportunidade' },
        { status: 403 }
      )
    }

    // Validate stage transition
    if (!canTransitionToStage(currentOpportunity.stage as OpportunityStage, validatedData.stageTo)) {
      return NextResponse.json(
        { success: false, error: 'Transição de etapa não permitida' },
        { status: 400 }
      )
    }

    // Stage-specific validations
    const requirements = StageRequirements[validatedData.stageTo]

    // Check required fields
    if (requirements.requiredFields.includes('amountBr')) {
      if (!validatedData.amountBr && !currentOpportunity.amountBr) {
        return NextResponse.json(
          { success: false, error: 'Valor da oportunidade é obrigatório para esta etapa' },
          { status: 400 }
        )
      }
    }

    if (requirements.requiredFields.includes('lostReason')) {
      if (!validatedData.lostReason) {
        return NextResponse.json(
          { success: false, error: 'Motivo da perda é obrigatório' },
          { status: 400 }
        )
      }
    }

    // Update opportunity with transaction
    const updatedOpportunity = await prisma.$transaction(async (tx) => {
      // Get stage probability
      const stageProbability = await tx.stageProbability.findUnique({
        where: { stage: validatedData.stageTo },
      })

      const updateData: any = {
        stage: validatedData.stageTo,
        probability: stageProbability?.probability || 0,
      }

      // Update amount if provided
      if (validatedData.amountBr) {
        updateData.amountBr = validatedData.amountBr
      }

      // Set lost reason for LOST stage
      if (validatedData.stageTo === OpportunityStage.LOST && validatedData.lostReason) {
        updateData.lostReason = validatedData.lostReason
      }

      // Set closedAt for WON stage
      if (validatedData.stageTo === OpportunityStage.WON) {
        updateData.closedAt = new Date()
      }

      // Update opportunity
      const opportunity = await tx.opportunity.update({
        where: { id },
        data: updateData,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              company: true,
              source: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Create stage history
      await tx.stageHistory.create({
        data: {
          opportunityId: id,
          stageFrom: currentOpportunity.stage,
          stageTo: validatedData.stageTo,
          changedBy: session.user.id,
        },
      })

      return updatedOpportunity
    })

    // Sincroniza o status do lead com a oportunidade (fora da transação)
    await syncLeadWithOpportunity(id, validatedData.stageTo)

    // Suggest next actions for certain stages
    let suggestedActions: string[] = []

    switch (validatedData.stageTo) {
      case OpportunityStage.QUALIFICATION:
        suggestedActions = ['Agendar call de qualificação', 'Enviar questionário de descoberta']
        break
      case OpportunityStage.DISCOVERY:
        suggestedActions = ['Mapear dores e necessidades', 'Identificar decision makers']
        break
      case OpportunityStage.PROPOSAL:
        suggestedActions = ['Preparar proposta comercial', 'Agendar apresentação']
        break
      case OpportunityStage.NEGOTIATION:
        suggestedActions = ['Enviar contrato', 'Agendar call de fechamento']
        break
    }

    return NextResponse.json({
      success: true,
      data: updatedOpportunity,
      suggestedActions,
      message: `Oportunidade movida para ${validatedData.stageTo} com sucesso`,
    })
  } catch (error) {
    console.error('Error transitioning opportunity stage:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}