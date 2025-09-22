import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createOpportunityFromLead } from '@/lib/services/lead-opportunity-integration'
import { z } from 'zod'

const convertSchema = z.object({
  amountBr: z.number().positive().optional(),
  expectedCloseAt: z.string().optional().transform(val => val ? new Date(val) : undefined),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
    }

    if (!hasPermission(session.user.role, PERMISSIONS.OPPORTUNITIES_CREATE)) {
      return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 })
    }

    const { id: leadId } = await params
    const body = await request.json()
    const data = convertSchema.parse(body)

    const result = await createOpportunityFromLead({
      leadId,
      ownerId: session.user.id,
      amountBr: data.amountBr,
      expectedCloseAt: data.expectedCloseAt,
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: result.opportunity,
      message: 'Lead convertido em oportunidade com sucesso'
    })

  } catch (error) {
    console.error('Erro ao converter lead:', error)
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 })
  }
}