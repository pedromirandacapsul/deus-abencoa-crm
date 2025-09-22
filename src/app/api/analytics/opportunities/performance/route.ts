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
    const ownerId = searchParams.get('owner_id')

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

    // Filter by owner if specified (and user has permission)
    if (ownerId) {
      if (userRole === 'SALES' && ownerId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Sem permissão para ver performance de outros usuários' },
          { status: 403 }
        )
      }
      where.ownerId = ownerId
    } else if (userRole === 'SALES') {
      // Sales users can only see their own performance
      where.ownerId = session.user.id
    }

    // Get opportunities with owner info
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
            source: true,
          },
        },
      },
    })

    // Calculate performance metrics by owner
    const performanceByOwner = new Map()

    opportunities.forEach((opp) => {
      const ownerId = opp.ownerId
      const ownerName = opp.owner.name

      if (!performanceByOwner.has(ownerId)) {
        performanceByOwner.set(ownerId, {
          ownerId,
          ownerName,
          totalOpportunities: 0,
          totalValue: 0,
          wonOpportunities: 0,
          wonValue: 0,
          lostOpportunities: 0,
          lostValue: 0,
          activeOpportunities: 0,
          activeValue: 0,
          avgDealSize: 0,
          conversionRate: 0,
          avgDaysToClose: 0,
          closedDeals: [],
        })
      }

      const performance = performanceByOwner.get(ownerId)
      performance.totalOpportunities++
      performance.totalValue += opp.amountBr || 0

      if (opp.stage === OpportunityStage.WON) {
        performance.wonOpportunities++
        performance.wonValue += opp.amountBr || 0
        if (opp.closedAt) {
          const daysToClose = Math.floor(
            (opp.closedAt.getTime() - opp.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          performance.closedDeals.push(daysToClose)
        }
      } else if (opp.stage === OpportunityStage.LOST) {
        performance.lostOpportunities++
        performance.lostValue += opp.amountBr || 0
        if (opp.closedAt) {
          const daysToClose = Math.floor(
            (opp.closedAt.getTime() - opp.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          performance.closedDeals.push(daysToClose)
        }
      } else {
        performance.activeOpportunities++
        performance.activeValue += opp.amountBr || 0
      }
    })

    // Calculate final metrics
    const performanceData = Array.from(performanceByOwner.values()).map((performance) => {
      performance.avgDealSize = performance.totalOpportunities > 0
        ? performance.totalValue / performance.totalOpportunities
        : 0

      performance.conversionRate = performance.totalOpportunities > 0
        ? (performance.wonOpportunities / performance.totalOpportunities) * 100
        : 0

      performance.avgDaysToClose = performance.closedDeals.length > 0
        ? performance.closedDeals.reduce((sum, days) => sum + days, 0) / performance.closedDeals.length
        : 0

      // Remove closedDeals array from response
      delete performance.closedDeals

      return performance
    })

    // Sort by total value descending
    performanceData.sort((a, b) => b.totalValue - a.totalValue)

    // Calculate overall totals
    const totals = {
      totalOpportunities: opportunities.length,
      totalValue: opportunities.reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
      wonOpportunities: opportunities.filter(opp => opp.stage === OpportunityStage.WON).length,
      wonValue: opportunities
        .filter(opp => opp.stage === OpportunityStage.WON)
        .reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
      lostOpportunities: opportunities.filter(opp => opp.stage === OpportunityStage.LOST).length,
      lostValue: opportunities
        .filter(opp => opp.stage === OpportunityStage.LOST)
        .reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
      activeOpportunities: opportunities.filter(opp =>
        ![OpportunityStage.WON, OpportunityStage.LOST].includes(opp.stage as OpportunityStage)
      ).length,
      activeValue: opportunities
        .filter(opp => ![OpportunityStage.WON, OpportunityStage.LOST].includes(opp.stage as OpportunityStage))
        .reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
    }

    totals.avgDealSize = totals.totalOpportunities > 0 ? totals.totalValue / totals.totalOpportunities : 0
    totals.conversionRate = totals.totalOpportunities > 0 ? (totals.wonOpportunities / totals.totalOpportunities) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        period: {
          from: fromDate,
          to: toDate,
        },
        totals,
        byOwner: performanceData,
      },
    })
  } catch (error) {
    console.error('Error fetching opportunity performance:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}