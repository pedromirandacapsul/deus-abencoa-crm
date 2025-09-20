import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().transform(str => str ? new Date(str) : null).optional(),
  assigneeId: z.string().optional(),
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

    const { id } = await params
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            company: true,
            email: true,
            phone: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Tarefa não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: task,
    })
  } catch (error) {
    console.error('Error fetching task:', error)
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

    const body = await request.json()
    const validatedData = updateTaskSchema.parse(body)

    const { id } = await params

    // Get current task to track changes
    const currentTask = await prisma.task.findUnique({
      where: { id },
    })

    if (!currentTask) {
      return NextResponse.json(
        { success: false, error: 'Tarefa não encontrada' },
        { status: 404 }
      )
    }

    // Verify assignee exists if changing
    if (validatedData.assigneeId && validatedData.assigneeId !== currentTask.assigneeId) {
      const assignee = await prisma.user.findUnique({
        where: { id: validatedData.assigneeId },
      })

      if (!assignee) {
        return NextResponse.json(
          { success: false, error: 'Responsável não encontrado' },
          { status: 404 }
        )
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedTask,
      message: 'Tarefa atualizada com sucesso',
    })
  } catch (error) {
    console.error('Error updating task:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

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

    const { id } = await params
    const task = await prisma.task.findUnique({
      where: { id },
    })

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Tarefa não encontrada' },
        { status: 404 }
      )
    }

    // Check if user can delete this task (creator or admin)
    if (task.creatorId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Sem permissão para deletar esta tarefa' },
        { status: 403 }
      )
    }

    await prisma.task.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Tarefa deletada com sucesso',
    })
  } catch (error) {
    console.error('Error deleting task:', error)
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}