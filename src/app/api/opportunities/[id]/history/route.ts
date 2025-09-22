import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

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
        { success: false, error: 'Sem permissão para visualizar histórico de oportunidades' },
        { status: 403 }
      )
    }

    // Check if opportunity exists and user has access
    const { id } = await params
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
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
        { success: false, error: 'Sem permissão para visualizar histórico desta oportunidade' },
        { status: 403 }
      )
    }

    // Get stage history
    const stageHistory = await prisma.stageHistory.findMany({
      where: { opportunityId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        changedAt: 'desc',
      },
    })

    // Calculate time spent in each stage
    const historyWithDuration = stageHistory.map((entry, index) => {
      let duration = null

      if (index < stageHistory.length - 1) {
        const nextEntry = stageHistory[index + 1]
        const diffMs = entry.changedAt.getTime() - nextEntry.changedAt.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

        if (diffDays > 0) {
          duration = `${diffDays}d ${diffHours}h`
        } else {
          duration = `${diffHours}h`
        }
      }

      return {
        ...entry,
        duration,
      }
    })

    return NextResponse.json({
      success: true,
      data: historyWithDuration,
    })
  } catch (error) {
    console.error('Error fetching opportunity history:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}