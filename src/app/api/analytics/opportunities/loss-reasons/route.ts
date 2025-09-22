import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { OpportunityStage, LossReason } from '@/lib/types/opportunity'

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
    const ownerId = searchParams.get('owner_id')

    // Default to last 90 days if no dates provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    const toDate = to ? new Date(to) : new Date()

    // Build where clause for lost opportunities
    const where: any = {
      stage: OpportunityStage.LOST,
      closedAt: {
        gte: fromDate,
        lte: toDate,
      },
    }

    // Filter by owner if specified (and user has permission)
    if (ownerId) {
      if (userRole === 'SALES' && ownerId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Sem permissão para ver dados de outros usuários' },
          { status: 403 }
        )
      }
      where.ownerId = ownerId
    } else if (userRole === 'SALES') {
      // Sales users can only see their own data
      where.ownerId = session.user.id
    }

    // Get lost opportunities
    const lostOpportunities = await prisma.opportunity.findMany({
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
        stageHistory: {
          select: {
            stageFrom: true,
            stageTo: true,
            changedAt: true,
          },
          orderBy: {
            changedAt: 'asc',
          },
        },
      },
    })

    // Analyze loss reasons
    const lossReasonStats = new Map()
    const lossReasonsByOwner = new Map()
    const lossReasonsBySource = new Map()
    const lossReasonsByStage = new Map()

    // Initialize loss reason stats
    Object.values(LossReason).forEach(reason => {
      lossReasonStats.set(reason, {
        reason,
        count: 0,
        totalValue: 0,
        avgValue: 0,
        percentage: 0,
        opportunities: [],
      })
    })

    // Initialize "No Reason" category for opportunities without loss reason
    lossReasonStats.set('NO_REASON', {
      reason: 'NO_REASON',
      count: 0,
      totalValue: 0,
      avgValue: 0,
      percentage: 0,
      opportunities: [],
    })

    // Process lost opportunities
    lostOpportunities.forEach((opp) => {
      const lossReason = opp.lostReason || 'NO_REASON'
      const value = opp.amountBr || 0

      // Overall loss reason stats
      const reasonData = lossReasonStats.get(lossReason)
      if (reasonData) {
        reasonData.count++
        reasonData.totalValue += value
        reasonData.opportunities.push({
          id: opp.id,
          amountBr: value,
          createdAt: opp.createdAt,
          closedAt: opp.closedAt,
          lead: opp.lead,
          owner: opp.owner,
        })
      }

      // By owner
      const ownerId = opp.ownerId
      if (!lossReasonsByOwner.has(ownerId)) {
        lossReasonsByOwner.set(ownerId, {
          ownerId,
          ownerName: opp.owner.name,
          totalLost: 0,
          totalValue: 0,
          reasons: new Map(),
        })
      }

      const ownerData = lossReasonsByOwner.get(ownerId)
      ownerData.totalLost++
      ownerData.totalValue += value

      if (!ownerData.reasons.has(lossReason)) {
        ownerData.reasons.set(lossReason, { count: 0, value: 0 })
      }
      ownerData.reasons.get(lossReason).count++
      ownerData.reasons.get(lossReason).value += value

      // By source
      const source = opp.lead.source || 'UNKNOWN'
      if (!lossReasonsBySource.has(source)) {
        lossReasonsBySource.set(source, {
          source,
          totalLost: 0,
          totalValue: 0,
          reasons: new Map(),
        })
      }

      const sourceData = lossReasonsBySource.get(source)
      sourceData.totalLost++
      sourceData.totalValue += value

      if (!sourceData.reasons.has(lossReason)) {
        sourceData.reasons.set(lossReason, { count: 0, value: 0 })
      }
      sourceData.reasons.get(lossReason).count++
      sourceData.reasons.get(lossReason).value += value

      // By stage where lost (last stage before LOST)
      const stageHistory = opp.stageHistory
      let lostFromStage = 'NEW' // Default if no history

      if (stageHistory.length > 0) {
        // Find the stage before LOST
        const lostHistoryEntry = stageHistory.find(h => h.stageTo === OpportunityStage.LOST)
        if (lostHistoryEntry) {
          lostFromStage = lostHistoryEntry.stageFrom
        }
      }

      if (!lossReasonsByStage.has(lostFromStage)) {
        lossReasonsByStage.set(lostFromStage, {
          stage: lostFromStage,
          totalLost: 0,
          totalValue: 0,
          reasons: new Map(),
        })
      }

      const stageData = lossReasonsByStage.get(lostFromStage)
      stageData.totalLost++
      stageData.totalValue += value

      if (!stageData.reasons.has(lossReason)) {
        stageData.reasons.set(lossReason, { count: 0, value: 0 })
      }
      stageData.reasons.get(lossReason).count++
      stageData.reasons.get(lossReason).value += value
    })

    // Calculate percentages and averages
    const totalLost = lostOpportunities.length
    const totalValue = lostOpportunities.reduce((sum, opp) => sum + (opp.amountBr || 0), 0)

    Array.from(lossReasonStats.values()).forEach((reasonData) => {
      reasonData.percentage = totalLost > 0 ? (reasonData.count / totalLost) * 100 : 0
      reasonData.avgValue = reasonData.count > 0 ? reasonData.totalValue / reasonData.count : 0

      // Sort opportunities by value desc
      reasonData.opportunities.sort((a, b) => (b.amountBr || 0) - (a.amountBr || 0))
    })

    // Convert owner data
    const ownerAnalysis = Array.from(lossReasonsByOwner.values()).map(ownerData => ({
      ...ownerData,
      reasons: Array.from(ownerData.reasons.entries()).map(([reason, data]) => ({
        reason,
        count: data.count,
        value: data.value,
        percentage: (data.count / ownerData.totalLost) * 100,
      })).sort((a, b) => b.count - a.count),
    })).sort((a, b) => b.totalLost - a.totalLost)

    // Convert source data
    const sourceAnalysis = Array.from(lossReasonsBySource.values()).map(sourceData => ({
      ...sourceData,
      reasons: Array.from(sourceData.reasons.entries()).map(([reason, data]) => ({
        reason,
        count: data.count,
        value: data.value,
        percentage: (data.count / sourceData.totalLost) * 100,
      })).sort((a, b) => b.count - a.count),
    })).sort((a, b) => b.totalLost - a.totalLost)

    // Convert stage data
    const stageAnalysis = Array.from(lossReasonsByStage.values()).map(stageData => ({
      ...stageData,
      reasons: Array.from(stageData.reasons.entries()).map(([reason, data]) => ({
        reason,
        count: data.count,
        value: data.value,
        percentage: (data.count / stageData.totalLost) * 100,
      })).sort((a, b) => b.count - a.count),
    })).sort((a, b) => b.totalLost - a.totalLost)

    // Calculate trends (compare with previous period)
    const trends = await calculateLossReasonTrends(fromDate, toDate, where)

    return NextResponse.json({
      success: true,
      data: {
        period: {
          from: fromDate,
          to: toDate,
        },
        summary: {
          totalLost,
          totalValue: Math.round(totalValue),
          avgLossValue: totalLost > 0 ? Math.round(totalValue / totalLost) : 0,
        },
        reasonBreakdown: Array.from(lossReasonStats.values())
          .filter(r => r.count > 0)
          .sort((a, b) => b.count - a.count),
        byOwner: ownerAnalysis,
        bySource: sourceAnalysis,
        byStage: stageAnalysis,
        trends,
      },
    })
  } catch (error) {
    console.error('Error analyzing loss reasons:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

async function calculateLossReasonTrends(fromDate: Date, toDate: Date, baseWhere: any) {
  try {
    // Calculate previous period (same duration)
    const periodDuration = toDate.getTime() - fromDate.getTime()
    const prevFromDate = new Date(fromDate.getTime() - periodDuration)
    const prevToDate = new Date(fromDate.getTime())

    const prevWhere = {
      ...baseWhere,
      closedAt: {
        gte: prevFromDate,
        lte: prevToDate,
      },
    }

    const prevLostOpportunities = await prisma.opportunity.findMany({
      where: prevWhere,
      select: {
        lostReason: true,
        amountBr: true,
      },
    })

    // Analyze previous period
    const prevReasonStats = new Map()
    Object.values(LossReason).forEach(reason => {
      prevReasonStats.set(reason, { count: 0, value: 0 })
    })
    prevReasonStats.set('NO_REASON', { count: 0, value: 0 })

    prevLostOpportunities.forEach(opp => {
      const reason = opp.lostReason || 'NO_REASON'
      const stats = prevReasonStats.get(reason)
      if (stats) {
        stats.count++
        stats.value += opp.amountBr || 0
      }
    })

    const trends = []
    for (const [reason, prevStats] of prevReasonStats.entries()) {
      trends.push({
        reason,
        previousCount: prevStats.count,
        previousValue: prevStats.value,
        trend: 'stable', // Will be calculated on frontend based on current vs previous
      })
    }

    return trends
  } catch (error) {
    console.error('Error calculating loss reason trends:', error)
    return []
  }
}