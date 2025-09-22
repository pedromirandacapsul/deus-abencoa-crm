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
    const window = searchParams.get('window') || '30' // days
    const ownerId = searchParams.get('owner_id')

    const windowDays = parseInt(window)
    const forecastEndDate = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000)

    // Build where clause for opportunities expected to close within window
    const where: any = {
      stage: {
        not: OpportunityStage.LOST, // Exclude lost opportunities
      },
      OR: [
        {
          expectedCloseAt: {
            lte: forecastEndDate,
          },
        },
        {
          expectedCloseAt: null, // Include opportunities without expected close date
        },
      ],
    }

    // Filter by owner if specified (and user has permission)
    if (ownerId) {
      if (userRole === 'SALES' && ownerId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Sem permissão para ver forecast de outros usuários' },
          { status: 403 }
        )
      }
      where.ownerId = ownerId
    } else if (userRole === 'SALES') {
      // Sales users can only see their own forecast
      where.ownerId = session.user.id
    }

    // Get opportunities for forecast
    const opportunities = await prisma.opportunity.findMany({
      where,
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
            source: true,
          },
        },
      },
      orderBy: [
        { expectedCloseAt: 'asc' },
        { probability: 'desc' },
      ],
    })

    // Get stage probabilities
    const stageProbabilities = await prisma.stageProbability.findMany()
    const probabilityMap = new Map(
      stageProbabilities.map(sp => [sp.stage, sp.probability])
    )

    // Calculate forecast metrics
    let bestCase = 0 // All deals close at full value
    let worstCase = 0 // Only WON deals
    let mostLikely = 0 // Weighted by probability
    let commitForecast = 0 // High probability deals (>70%)

    const forecastByStage = new Map()
    const forecastByOwner = new Map()
    const forecastByMonth = new Map()

    // Initialize stage forecast
    Object.values(OpportunityStage).forEach(stage => {
      if (stage !== OpportunityStage.LOST) {
        forecastByStage.set(stage, {
          stage,
          count: 0,
          totalValue: 0,
          weightedValue: 0,
          avgProbability: 0,
          opportunities: [],
        })
      }
    })

    opportunities.forEach((opp) => {
      const value = opp.amountBr || 0
      const stageProbability = probabilityMap.get(opp.stage) || 0
      const oppProbability = opp.probability || stageProbability
      const weightedValue = value * (oppProbability / 100)

      // Calculate forecast totals
      bestCase += value
      if (opp.stage === OpportunityStage.WON) {
        worstCase += value
      }
      mostLikely += weightedValue
      if (oppProbability >= 70) {
        commitForecast += weightedValue
      }

      // Group by stage
      const stageData = forecastByStage.get(opp.stage)
      if (stageData) {
        stageData.count++
        stageData.totalValue += value
        stageData.weightedValue += weightedValue
        stageData.opportunities.push({
          id: opp.id,
          amountBr: value,
          probability: oppProbability,
          expectedCloseAt: opp.expectedCloseAt,
          lead: opp.lead,
        })
      }

      // Group by owner
      const ownerId = opp.ownerId
      if (!forecastByOwner.has(ownerId)) {
        forecastByOwner.set(ownerId, {
          ownerId,
          ownerName: opp.owner.name,
          count: 0,
          totalValue: 0,
          weightedValue: 0,
          commitValue: 0,
        })
      }

      const ownerData = forecastByOwner.get(ownerId)
      ownerData.count++
      ownerData.totalValue += value
      ownerData.weightedValue += weightedValue
      if (oppProbability >= 70) {
        ownerData.commitValue += weightedValue
      }

      // Group by month
      const closeDate = opp.expectedCloseAt || new Date()
      const monthKey = `${closeDate.getFullYear()}-${String(closeDate.getMonth() + 1).padStart(2, '0')}`

      if (!forecastByMonth.has(monthKey)) {
        forecastByMonth.set(monthKey, {
          month: monthKey,
          count: 0,
          totalValue: 0,
          weightedValue: 0,
          commitValue: 0,
        })
      }

      const monthData = forecastByMonth.get(monthKey)
      monthData.count++
      monthData.totalValue += value
      monthData.weightedValue += weightedValue
      if (oppProbability >= 70) {
        monthData.commitValue += weightedValue
      }
    })

    // Calculate averages for stages
    Array.from(forecastByStage.values()).forEach((stageData) => {
      stageData.avgProbability = stageData.count > 0
        ? (stageData.weightedValue / stageData.totalValue) * 100
        : 0

      // Sort opportunities by probability desc
      stageData.opportunities.sort((a, b) => (b.probability || 0) - (a.probability || 0))
    })

    // Calculate historical accuracy (for the same period in previous months)
    const historicalAccuracy = await calculateForecastAccuracy(windowDays, where)

    // Calculate confidence levels based on historical performance
    const confidence = {
      bestCase: 10, // Very optimistic
      mostLikely: historicalAccuracy.avgAccuracy || 75, // Based on historical performance
      commitForecast: 90, // High confidence
      worstCase: 99, // Very conservative
    }

    return NextResponse.json({
      success: true,
      data: {
        period: {
          window: windowDays,
          endDate: forecastEndDate,
        },
        summary: {
          bestCase: Math.round(bestCase),
          worstCase: Math.round(worstCase),
          mostLikely: Math.round(mostLikely),
          commitForecast: Math.round(commitForecast),
          totalOpportunities: opportunities.length,
          confidence,
        },
        byStage: Array.from(forecastByStage.values()),
        byOwner: Array.from(forecastByOwner.values()).sort((a, b) => b.weightedValue - a.weightedValue),
        byMonth: Array.from(forecastByMonth.values()).sort((a, b) => a.month.localeCompare(b.month)),
        historicalAccuracy,
      },
    })
  } catch (error) {
    console.error('Error generating forecast:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function calculateForecastAccuracy(windowDays: number, baseWhere: any) {
  try {
    // Get opportunities that were forecasted in previous periods and are now closed
    const historicalPeriods = [1, 2, 3] // Check last 3 similar periods
    const accuracyData = []

    for (const periodOffset of historicalPeriods) {
      const periodStart = new Date(Date.now() - (periodOffset + 1) * windowDays * 24 * 60 * 60 * 1000)
      const periodEnd = new Date(Date.now() - periodOffset * windowDays * 24 * 60 * 60 * 1000)

      // Get opportunities that were expected to close in this period
      const historicalOpps = await prisma.opportunity.findMany({
        where: {
          ...baseWhere,
          expectedCloseAt: {
            gte: periodStart,
            lte: periodEnd,
          },
          stage: {
            in: [OpportunityStage.WON, OpportunityStage.LOST],
          },
        },
      })

      if (historicalOpps.length > 0) {
        const forecasted = historicalOpps.reduce((sum, opp) => sum + (opp.amountBr || 0), 0)
        const actual = historicalOpps
          .filter(opp => opp.stage === OpportunityStage.WON)
          .reduce((sum, opp) => sum + (opp.amountBr || 0), 0)

        const accuracy = forecasted > 0 ? (actual / forecasted) * 100 : 0

        accuracyData.push({
          period: `${periodOffset} periods ago`,
          forecasted,
          actual,
          accuracy: Math.round(accuracy),
        })
      }
    }

    const avgAccuracy = accuracyData.length > 0
      ? accuracyData.reduce((sum, data) => sum + data.accuracy, 0) / accuracyData.length
      : null

    return {
      avgAccuracy: avgAccuracy ? Math.round(avgAccuracy) : null,
      historical: accuracyData,
    }
  } catch (error) {
    console.error('Error calculating forecast accuracy:', error)
    return {
      avgAccuracy: null,
      historical: [],
    }
  }
}