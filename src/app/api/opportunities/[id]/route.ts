import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { OpportunityStage, LossReason, StageRequirements } from '@/lib/types/opportunity'
import { z } from 'zod'

const updateOpportunitySchema = z.object({
  stage: z.nativeEnum(OpportunityStage).optional(),
  amountBr: z.number().positive().optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseAt: z.string().optional(),
  discountPct: z.number().min(0).max(100).optional(),
  costEstimatedBr: z.number().positive().optional(),
  lostReason: z.nativeEnum(LossReason).optional(),
})

export async function GET(
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
    if (!hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_VIEW)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para visualizar oportunidades' },
        { status: 403 }
      )
    }

    const { id } = await params
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            source: true,
            roleTitle: true,
            interest: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: true,
        stageHistory: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            changedAt: 'desc',
          },
        },
        tasks: {
          where: {
            status: { not: 'CANCELLED' },
          },
          include: {
            assignee: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            dueAt: 'asc',
          },
        },
      },
    })

    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: 'Oportunidade não encontrada' },
        { status: 404 }
      )
    }

    // Role-based access control
    if (userRole === 'SALES' && opportunity.ownerId !== session.user.id) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para visualizar esta oportunidade' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: opportunity,
    })
  } catch (error) {
    console.error('Error fetching opportunity:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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
        { success: false, error: 'Sem permissão para atualizar oportunidades' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateOpportunitySchema.parse(body)

    const { id } = await params
    // Get current opportunity
    const currentOpportunity = await prisma.opportunity.findUnique({
      where: { id },
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
        { success: false, error: 'Sem permissão para atualizar esta oportunidade' },
        { status: 403 }
      )
    }

    // Validation for WON stage - only admin can modify amount after WON
    if (currentOpportunity.stage === OpportunityStage.WON && validatedData.amountBr) {
      if (userRole !== 'ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Apenas administradores podem alterar o valor após o fechamento' },
          { status: 403 }
        )
      }

      // Log amount change for audit
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_WON_AMOUNT',
          resource: 'Opportunity',
          resourceId: id,
          oldValues: JSON.stringify({ amountBr: currentOpportunity.amountBr }),
          newValues: JSON.stringify({ amountBr: validatedData.amountBr }),
          metadata: JSON.stringify({ reason: 'Admin override after won' }),
        },
      })
    }

    // Stage-specific validations
    if (validatedData.stage) {
      const requirements = StageRequirements[validatedData.stage]

      // Validate required fields for stage
      if (requirements.requiredFields.includes('amountBr') && !validatedData.amountBr && !currentOpportunity.amountBr) {
        return NextResponse.json(
          { success: false, error: 'Valor da oportunidade é obrigatório para esta etapa' },
          { status: 400 }
        )
      }

      if (requirements.requiredFields.includes('lostReason') && !validatedData.lostReason) {
        return NextResponse.json(
          { success: false, error: 'Motivo da perda é obrigatório para marcar como perdido' },
          { status: 400 }
        )
      }
    }

    // Update opportunity with transaction
    const updatedOpportunity = await prisma.$transaction(async (tx) => {
      const updateData: any = {
        ...validatedData,
        expectedCloseAt: validatedData.expectedCloseAt ? new Date(validatedData.expectedCloseAt) : undefined,
      }

      // Set closedAt for WON stage
      if (validatedData.stage === OpportunityStage.WON) {
        updateData.closedAt = new Date()
      }

      // Auto-update probability if stage changed and user is not manager/admin
      if (validatedData.stage && validatedData.stage !== currentOpportunity.stage) {
        if (userRole === 'SALES' || !validatedData.probability) {
          const stageProbability = await tx.stageProbability.findUnique({
            where: { stage: validatedData.stage },
          })
          if (stageProbability) {
            updateData.probability = stageProbability.probability
          }
        }

        // Create stage history
        await tx.stageHistory.create({
          data: {
            opportunityId: id,
            stageFrom: currentOpportunity.stage,
            stageTo: validatedData.stage,
            changedBy: session.user.id,
          },
        })
      }

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
          items: true,
        },
      })

      return opportunity
    })

    return NextResponse.json({
      success: true,
      data: updatedOpportunity,
      message: 'Oportunidade atualizada com sucesso',
    })
  } catch (error) {
    console.error('Error updating opportunity:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    if (!hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_DELETE)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para excluir oportunidades' },
        { status: 403 }
      )
    }

    const { id } = await params
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
    })

    if (!opportunity) {
      return NextResponse.json(
        { success: false, error: 'Oportunidade não encontrada' },
        { status: 404 }
      )
    }

    // Only allow deletion of NEW or QUALIFICATION stages
    if (!['NEW', 'QUALIFICATION'].includes(opportunity.stage)) {
      return NextResponse.json(
        { success: false, error: 'Apenas oportunidades em estágio inicial podem ser excluídas' },
        { status: 400 }
      )
    }

    await prisma.opportunity.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Oportunidade excluída com sucesso',
    })
  } catch (error) {
    console.error('Error deleting opportunity:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}