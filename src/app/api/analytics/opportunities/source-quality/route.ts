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

    // Default to last 90 days if no dates provided
    const fromDate = from ? new Date(from) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
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

    // Get opportunities with lead source data
    const opportunities = await prisma.opportunity.findMany({
      where,
      include: {
        lead: {
          select: {
            source: true,
            createdAt: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Analyze source quality
    const sourceQuality = new Map()

    opportunities.forEach((opp) => {
      const source = opp.lead.source || 'UNKNOWN'
      const value = opp.amountBr || 0

      if (!sourceQuality.has(source)) {
        sourceQuality.set(source, {
          source,
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
          avgTimeToClose: 0,
          qualityScore: 0,
          closedDeals: [],
          opportunities: [],
        })
      }

      const sourceData = sourceQuality.get(source)
      sourceData.totalOpportunities++
      sourceData.totalValue += value
      sourceData.opportunities.push({
        id: opp.id,
        stage: opp.stage,
        amountBr: value,
        createdAt: opp.createdAt,
        closedAt: opp.closedAt,
        owner: opp.owner,
      })

      if (opp.stage === OpportunityStage.WON) {
        sourceData.wonOpportunities++
        sourceData.wonValue += value
        if (opp.closedAt) {
          const timeToClose = Math.floor(
            (opp.closedAt.getTime() - opp.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          sourceData.closedDeals.push(timeToClose)
        }
      } else if (opp.stage === OpportunityStage.LOST) {
        sourceData.lostOpportunities++
        sourceData.lostValue += value
        if (opp.closedAt) {
          const timeToClose = Math.floor(
            (opp.closedAt.getTime() - opp.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          )
          sourceData.closedDeals.push(timeToClose)
        }
      } else {
        sourceData.activeOpportunities++
        sourceData.activeValue += value
      }
    })

    // Calculate metrics and quality scores
    const sourceAnalysis = Array.from(sourceQuality.values()).map((sourceData) => {
      // Basic metrics
      sourceData.avgDealSize = sourceData.totalOpportunities > 0
        ? sourceData.totalValue / sourceData.totalOpportunities
        : 0

      sourceData.conversionRate = sourceData.totalOpportunities > 0
        ? (sourceData.wonOpportunities / sourceData.totalOpportunities) * 100
        : 0

      sourceData.avgTimeToClose = sourceData.closedDeals.length > 0
        ? sourceData.closedDeals.reduce((sum, days) => sum + days, 0) / sourceData.closedDeals.length
        : 0

      // Quality score calculation (0-100)
      // Factors: conversion rate (40%), avg deal size (30%), volume (20%), time to close (10%)
      const conversionScore = Math.min(sourceData.conversionRate * 2, 40) // Max 40 points

      // Normalize deal size score (assume $10k BRL is excellent)
      const dealSizeScore = Math.min((sourceData.avgDealSize / 10000) * 30, 30) // Max 30 points

      // Volume score (logarithmic scale, 50+ opportunities = max points)
      const volumeScore = Math.min((Math.log10(sourceData.totalOpportunities + 1) / Math.log10(51)) * 20, 20) // Max 20 points

      // Time to close score (faster = better, 30 days = max points)
      const timeScore = sourceData.avgTimeToClose > 0
        ? Math.max(10 - (sourceData.avgTimeToClose / 30) * 10, 0) // Max 10 points
        : 5 // Default score if no closed deals

      sourceData.qualityScore = Math.round(conversionScore + dealSizeScore + volumeScore + timeScore)

      // Remove internal arrays
      delete sourceData.closedDeals

      // Sort opportunities by value desc and limit to top 10
      sourceData.opportunities = sourceData.opportunities
        .sort((a, b) => (b.amountBr || 0) - (a.amountBr || 0))
        .slice(0, 10)

      return sourceData
    })

    // Sort by quality score descending
    sourceAnalysis.sort((a, b) => b.qualityScore - a.qualityScore)

    // Calculate overall metrics
    const totals = {
      totalOpportunities: opportunities.length,
      totalValue: opportunities.reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
      wonOpportunities: opportunities.filter(opp => opp.stage === OpportunityStage.WON).length,
      wonValue: opportunities
        .filter(opp => opp.stage === OpportunityStage.WON)
        .reduce((sum, opp) => sum + (opp.amountBr || 0), 0),
      totalSources: sourceAnalysis.length,
      avgQualityScore: sourceAnalysis.length > 0
        ? sourceAnalysis.reduce((sum, source) => sum + source.qualityScore, 0) / sourceAnalysis.length
        : 0,
    }

    // Find best and worst performing sources
    const bestSource = sourceAnalysis[0] || null
    const worstSource = sourceAnalysis.length > 0 ? sourceAnalysis[sourceAnalysis.length - 1] : null

    // Calculate source diversity (distribution of opportunities across sources)
    const diversityScore = calculateSourceDiversity(sourceAnalysis, totals.totalOpportunities)

    // Performance insights
    const insights = generateSourceInsights(sourceAnalysis, totals)

    return NextResponse.json({
      success: true,
      data: {
        period: {
          from: fromDate,
          to: toDate,
        },
        summary: {
          ...totals,
          avgQualityScore: Math.round(totals.avgQualityScore),
          diversityScore: Math.round(diversityScore),
          bestSource: bestSource?.source || null,
          worstSource: worstSource?.source || null,
        },
        sources: sourceAnalysis,
        insights,
      },
    })
  } catch (error) {
    console.error('Error analyzing source quality:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function calculateSourceDiversity(sources: any[], totalOpportunities: number): number {
  if (sources.length <= 1 || totalOpportunities === 0) return 0

  // Calculate Herfindahl-Hirschman Index (HHI) for diversity
  const hhi = sources.reduce((sum, source) => {
    const marketShare = source.totalOpportunities / totalOpportunities
    return sum + (marketShare * marketShare)
  }, 0)

  // Convert to diversity score (0-100, higher = more diverse)
  // HHI ranges from 1/n to 1, where n is number of sources
  const maxDiversity = 1 / sources.length
  const diversityScore = ((1 - hhi) / (1 - maxDiversity)) * 100

  return Math.max(0, diversityScore)
}

function generateSourceInsights(sources: any[], totals: any): string[] {
  const insights = []

  if (sources.length === 0) {
    insights.push('Nenhuma fonte de leads encontrada no período')
    return insights
  }

  // Best performing source
  const bestSource = sources[0]
  if (bestSource.qualityScore > 70) {
    insights.push(`${bestSource.source} é sua melhor fonte com score ${bestSource.qualityScore} e conversão de ${bestSource.conversionRate.toFixed(1)}%`)
  }

  // Sources with high volume but low conversion
  const highVolumeSource = sources.find(s => s.totalOpportunities >= 10 && s.conversionRate < 20)
  if (highVolumeSource) {
    insights.push(`${highVolumeSource.source} tem alto volume (${highVolumeSource.totalOpportunities} opps) mas baixa conversão (${highVolumeSource.conversionRate.toFixed(1)}%)`)
  }

  // Sources with high deal size
  const avgDealSize = totals.totalValue / totals.totalOpportunities
  const highValueSource = sources.find(s => s.avgDealSize > avgDealSize * 1.5)
  if (highValueSource) {
    insights.push(`${highValueSource.source} gera deals de alto valor (R$ ${highValueSource.avgDealSize.toLocaleString()})`)
  }

  // Quick closing sources
  const fastSource = sources.find(s => s.avgTimeToClose > 0 && s.avgTimeToClose < 30)
  if (fastSource) {
    insights.push(`${fastSource.source} tem ciclo rápido de fechamento (${fastSource.avgTimeToClose.toFixed(0)} dias)`)
  }

  // Underperforming sources
  const underperformingSource = sources.find(s => s.qualityScore < 30 && s.totalOpportunities >= 5)
  if (underperformingSource) {
    insights.push(`${underperformingSource.source} precisa de atenção - score baixo (${underperformingSource.qualityScore})`)
  }

  return insights.length > 0 ? insights : ['Dados insuficientes para gerar insights']
}