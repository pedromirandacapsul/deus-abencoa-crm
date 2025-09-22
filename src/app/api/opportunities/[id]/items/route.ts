import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { z } from 'zod'

const createItemSchema = z.object({
  productName: z.string().min(1, 'Nome do produto é obrigatório'),
  qty: z.number().int().positive('Quantidade deve ser maior que zero'),
  unitPriceBr: z.number().positive('Preço unitário deve ser maior que zero'),
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
        { success: false, error: 'Sem permissão para adicionar itens' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = createItemSchema.parse(body)

    // Check if opportunity exists and user has access
    const { id } = await params
    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: { id: true, ownerId: true, stage: true },
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
        { success: false, error: 'Sem permissão para modificar esta oportunidade' },
        { status: 403 }
      )
    }

    // Prevent modification if opportunity is closed
    if (['WON', 'LOST'].includes(opportunity.stage)) {
      return NextResponse.json(
        { success: false, error: 'Não é possível adicionar itens a oportunidades fechadas' },
        { status: 400 }
      )
    }

    // Calculate subtotal
    const subtotalBr = validatedData.qty * validatedData.unitPriceBr

    // Create item
    const item = await prisma.opportunityItem.create({
      data: {
        opportunityId: id,
        productName: validatedData.productName,
        qty: validatedData.qty,
        unitPriceBr: validatedData.unitPriceBr,
        subtotalBr,
      },
    })

    // Update opportunity total amount
    const allItems = await prisma.opportunityItem.findMany({
      where: { opportunityId: id },
    })

    const totalAmount = allItems.reduce((sum, item) => sum + item.subtotalBr, 0)

    await prisma.opportunity.update({
      where: { id },
      data: { amountBr: totalAmount },
    })

    return NextResponse.json({
      success: true,
      data: item,
      message: 'Item adicionado com sucesso',
    })
  } catch (error) {
    console.error('Error creating opportunity item:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

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
        { success: false, error: 'Sem permissão para visualizar itens' },
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
        { success: false, error: 'Sem permissão para visualizar itens desta oportunidade' },
        { status: 403 }
      )
    }

    // Get items
    const items = await prisma.opportunityItem.findMany({
      where: { opportunityId: id },
      orderBy: { createdAt: 'asc' },
    })

    const total = items.reduce((sum, item) => sum + item.subtotalBr, 0)

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
      },
    })
  } catch (error) {
    console.error('Error fetching opportunity items:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}