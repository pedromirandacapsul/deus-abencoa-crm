import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { OpportunityStage } from '@/lib/types/opportunity'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const userRole = session.user.role
    if (!hasPermission(userRole, PERMISSIONS.ANALYTICS_VIEW)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para visualizar analytics' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Default to last 30 days if no dates provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const toDate = to ? new Date(to) : new Date()

    // Build where clause
    const where: any = {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    }

    // Sales users can only see their own opportunities
    if (userRole === 'SALES') {
      where.ownerId = session.user.id
    }

    // Get opportunities with stage probabilities
    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Get stage probabilities for calculations
    const stageProbabilities = await prisma.stageProbability.findMany()
    const probabilityMap = new Map(
      stageProbabilities.map(sp => [sp.stage, sp.probability])
    )

    // Calculate pipeline by stage
    const pipelineByStage = new Map()

    // Initialize all stages
    Object.values(OpportunityStage).forEach(stage => {
      pipelineByStage.set(stage, {
        stage,
        count: 0,
        totalValue: 0,
        weightedValue: 0,
        avgDealSize: 0,
        probability: probabilityMap.get(stage) || 0,
        opportunities: [],
      })
    })

    // Process opportunities
    opportunities.forEach((opp) => {
      const stageData = pipelineByStage.get(opp.stage)
      if (stageData) {
        stageData.count++
        stageData.totalValue += opp.amountBr || 0
        stageData.weightedValue += (opp.amountBr || 0) * (stageData.probability / 100)
        stageData.opportunities.push({
          id: opp.id,
          amountBr: opp.amountBr,
          probability: opp.probability,
          expectedCloseAt: opp.expectedCloseAt,
          createdAt: opp.createdAt,
          owner: opp.owner,
        })
      }
    })

    // Calculate averages and sort opportunities
    const pipelineData = Array.from(pipelineByStage.values()).map((stageData) => {
      stageData.avgDealSize = stageData.count > 0 ? stageData.totalValue / stageData.count : 0

      // Sort opportunities by value desc
      stageData.opportunities.sort((a, b) => (b.amountBr || 0) - (a.amountBr || 0))

      return stageData
    })

    // Calculate velocity metrics (average time between stages)
    const velocityMetrics = await calculateStageVelocity(where)

    // Calculate conversion rates between stages
    const conversionRates = await calculateConversionRates(where)

    // Calculate pipeline totals
    const totals = {
      totalOpportunities: opportunities.length,
      totalValue: opportunities.reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
      totalWeightedValue: pipelineData.reduce((sum, stage) => sum + stage.weightedValue, 0),
      avgDealSize: 0,
    }

    totals.avgDealSize = totals.totalOpportunities > 0 ? totals.totalValue / totals.totalOpportunities : 0

    return NextResponse.json({
      success: true,
      data: {
        period: {
          from: fromDate,
          to: toDate,
        },
        totals,
        pipeline: pipelineData,
        velocity: velocityMetrics,
        conversionRates,
      },
    })
  } catch (error) {
    console.error('Error fetching pipeline analytics:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function calculateStageVelocity(baseWhere: any) {
  try {
    // Get stage history for velocity calculation
    const stageHistory = await prisma.stageHistory.findMany({
      where: {
        opportunity: {
          createdAt: baseWhere.createdAt,
        },
      },
      orderBy: [
        { opportunityId: 'asc' },
        { changedAt: 'asc' },
      ],
    })

    // Group by opportunity and calculate time between stages
    const velocityByStage = new Map()
    const opportunityStages = new Map()

    stageHistory.forEach((history) => {
      const oppId = history.opportunityId

      if (!opportunityStages.has(oppId)) {
        opportunityStages.set(oppId, [])
      }

      opportunityStages.get(oppId).push({
        stage: history.stageTo,
        changedAt: history.changedAt,
      })
    })

    // Calculate average time in each stage
    Object.values(OpportunityStage).forEach(stage => {
      velocityByStage.set(stage, {
        stage,
        avgDays: 0,
        count: 0,
        totalDays: 0,
      })
    })

    opportunityStages.forEach((stages, oppId) => {
      for (let i = 0; i < stages.length - 1; i++) {
        const currentStage = stages[i]
        const nextStage = stages[i + 1]

        const daysInStage = Math.floor(
          (nextStage.changedAt.getTime() - currentStage.changedAt.getTime()) / (1000 * 60 * 60 * 24)
        )

        const stageVelocity = velocityByStage.get(currentStage.stage)
        if (stageVelocity) {
          stageVelocity.totalDays += daysInStage
          stageVelocity.count++
        }
      }
    })

    // Calculate averages
    Array.from(velocityByStage.values()).forEach((velocity) => {
      velocity.avgDays = velocity.count > 0 ? velocity.totalDays / velocity.count : 0
      delete velocity.totalDays
      delete velocity.count
    })

    return Array.from(velocityByStage.values())
  } catch (error) {
    console.error('Error calculating stage velocity:', error)
    return []
  }
}

async function calculateConversionRates(baseWhere: any) {
  try {
    // Get all opportunities for conversion calculation
    const opportunities = await prisma.opportunity.findMany({
      where: baseWhere,
      select: {
        id: true,
        stage: true,
        createdAt: true,
      },
    })

    // Get stage history to track conversions
    const stageHistory = await prisma.stageHistory.findMany({
      where: {
        opportunity: {
          createdAt: baseWhere.createdAt,
        },
      },
    })

    // Calculate conversion rates between stages
    const stageFlow = new Map()

    Object.values(OpportunityStage).forEach(stage => {
      stageFlow.set(stage, {
        stage,
        entered: 0,
        converted: 0,
        conversionRate: 0,
      })
    })

    // Count entries to each stage
    stageHistory.forEach((history) => {
      const stageData = stageFlow.get(history.stageTo)
      if (stageData) {
        stageData.entered++
      }
    })

    // Count conversions (moves to next stage)
    stageHistory.forEach((history) => {
      const stageData = stageFlow.get(history.stageFrom)
      if (stageData) {
        stageData.converted++
      }
    })

    // Calculate conversion rates
    Array.from(stageFlow.values()).forEach((flow) => {
      flow.conversionRate = flow.entered > 0 ? (flow.converted / flow.entered) * 100 : 0
    })

    return Array.from(stageFlow.values())
  } catch (error) {
    console.error('Error calculating conversion rates:', error)
    return []
  }
}