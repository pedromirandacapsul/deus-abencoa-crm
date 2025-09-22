import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { OpportunityStage, DefaultProbabilities } from '@/lib/types/opportunity'
import { z } from 'zod'

const createOpportunitySchema = z.object({
  leadId: z.string(),
  ownerId: z.string().optional(),
  stage: z.nativeEnum(OpportunityStage).optional(),
  amountBr: z.number().positive().optional(),
  expectedCloseAt: z.string().optional(),
  discountPct: z.number().min(0).max(100).optional(),
  costEstimatedBr: z.number().positive().optional(),
})

const filtersSchema = z.object({
  ownerId: z.string().optional(),
  stage: z.string().optional(),
  leadSource: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  expectedFrom: z.string().optional(),
  expectedTo: z.string().optional(),
  search: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(20),
  sortBy: z.enum(['createdAt', 'amountBr', 'expectedCloseAt', 'stage']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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
    if (!hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_CREATE)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para criar oportunidades' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createOpportunitySchema.parse(body)

    // Check if lead exists and doesn't already have an opportunity
    const lead = await prisma.lead.findUnique({
      where: { id: validatedData.leadId },
      include: {
        opportunities: true,
      },
    })

    if (!lead) {
      return NextResponse.json(
        { success: false, error: 'Lead não encontrado' },
        { status: 404 }
      )
    }

    if (lead.opportunities.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Lead já possui uma oportunidade' },
        { status: 400 }
      )
    }

    // Use lead owner or provided owner
    const ownerId = validatedData.ownerId || lead.ownerId
    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'Owner é obrigatório' },
        { status: 400 }
      )
    }

    // Get default probability for stage
    const stage = validatedData.stage || OpportunityStage.NEW
    const defaultProbability = DefaultProbabilities[stage]

    const opportunity = await prisma.$transaction(async (tx) => {
      // Create opportunity
      const newOpportunity = await tx.opportunity.create({
        data: {
          leadId: validatedData.leadId,
          ownerId,
          stage,
          amountBr: validatedData.amountBr,
          probability: defaultProbability,
          expectedCloseAt: validatedData.expectedCloseAt ? new Date(validatedData.expectedCloseAt) : null,
          discountPct: validatedData.discountPct,
          costEstimatedBr: validatedData.costEstimatedBr,
        },
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

      // Create initial stage history
      await tx.stageHistory.create({
        data: {
          opportunityId: newOpportunity.id,
          stageFrom: null,
          stageTo: stage,
          changedBy: session.user.id,
        },
      })

      return newOpportunity
    })

    return NextResponse.json({
      success: true,
      data: opportunity,
      message: 'Oportunidade criada com sucesso',
    })
  } catch (error) {
    console.error('Error creating opportunity:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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
    if (!hasPermission(userRole, PERMISSIONS.OPPORTUNITIES_VIEW)) {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para visualizar oportunidades' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const filters = filtersSchema.parse({
      ownerId: searchParams.get('ownerId') || undefined,
      stage: searchParams.get('stage') || undefined,
      leadSource: searchParams.get('leadSource') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      expectedFrom: searchParams.get('expectedFrom') || undefined,
      expectedTo: searchParams.get('expectedTo') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      sortBy: searchParams.get('sortBy') as any || 'createdAt',
      sortOrder: searchParams.get('sortOrder') as any || 'desc',
    })

    // Build where clause
    const where: any = {}

    // Role-based filtering
    if (userRole === 'SALES') {
      where.ownerId = session.user.id
    } else if (filters.ownerId) {
      where.ownerId = filters.ownerId
    }

    if (filters.stage) where.stage = filters.stage

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
    }

    if (filters.expectedFrom || filters.expectedTo) {
      where.expectedCloseAt = {}
      if (filters.expectedFrom) where.expectedCloseAt.gte = new Date(filters.expectedFrom)
      if (filters.expectedTo) where.expectedCloseAt.lte = new Date(filters.expectedTo)
    }

    if (filters.leadSource) {
      where.lead = {
        source: { contains: filters.leadSource, mode: 'insensitive' },
      }
    }

    if (filters.search) {
      where.OR = [
        { lead: { name: { contains: filters.search, mode: 'insensitive' } } },
        { lead: { email: { contains: filters.search, mode: 'insensitive' } } },
        { lead: { company: { contains: filters.search, mode: 'insensitive' } } },
      ]
    }

    // Get total count
    const total = await prisma.opportunity.count({ where })

    // Get opportunities with pagination
    const opportunities = await prisma.opportunity.findMany({
      where,
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
        _count: {
          select: {
            items: true,
            tasks: true,
          },
        },
      },
      orderBy: {
        [filters.sortBy]: filters.sortOrder,
      },
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    })

    const totalPages = Math.ceil(total / filters.limit)

    return NextResponse.json({
      success: true,
      data: {
        opportunities,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages,
          hasNext: filters.page < totalPages,
          hasPrev: filters.page > 1,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching opportunities:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}