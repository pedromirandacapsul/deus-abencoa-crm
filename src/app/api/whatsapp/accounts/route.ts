import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    // TEMPORÁRIO: Bypass de autenticação para testes
    const skipAuth = true
    const userId = session?.user?.id || 'cmfsrmudu0000b240mvscfyge' // Admin user ID para bypass

    if (!session?.user?.id && !skipAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accounts = await prisma.whatsAppAccount.findMany({
      where: skipAuth ? {} : {
        userId: userId,
      },
      include: {
        _count: {
          select: {
            conversations: true,
            messages: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      accounts,
    })
  } catch (error) {
    console.error('Error fetching WhatsApp accounts:', error)
    console.log('Session:', session)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}