import { PrismaClient } from '@prisma/client'
import { OpportunityStage } from '@/lib/types/opportunity'

const prisma = new PrismaClient()

export interface CreateOpportunityFromLeadParams {
  leadId: string
  ownerId: string
  amountBr?: number
  expectedCloseAt?: Date
}

/**
 * Cria uma Oportunidade automaticamente quando um Lead é qualificado
 * Integra o fluxo: Lead → Oportunidade → Pipeline
 */
export async function createOpportunityFromLead({
  leadId,
  ownerId,
  amountBr,
  expectedCloseAt
}: CreateOpportunityFromLeadParams) {
  try {
    // Verifica se já existe uma oportunidade para este lead
    const existingOpportunity = await prisma.opportunity.findFirst({
      where: { leadId }
    })

    if (existingOpportunity) {
      return { success: false, error: 'Lead já possui uma oportunidade', opportunity: existingOpportunity }
    }

    // Busca probabilidade padrão do estágio NEW
    const stageProbability = await prisma.stageProbability.findUnique({
      where: { stage: OpportunityStage.NEW }
    })

    // Cria a oportunidade
    const opportunity = await prisma.opportunity.create({
      data: {
        leadId,
        ownerId,
        stage: OpportunityStage.NEW,
        amountBr,
        probability: stageProbability?.probability || 10,
        expectedCloseAt,
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            company: true,
            source: true,
          }
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      }
    })

    // Cria histórico inicial
    await prisma.stageHistory.create({
      data: {
        opportunityId: opportunity.id,
        fromStage: null,
        toStage: OpportunityStage.NEW,
        changedBy: ownerId,
        notes: 'Oportunidade criada automaticamente a partir do Lead',
      }
    })

    // Atualiza status do lead para indicar que virou oportunidade
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: 'QUALIFIED', // ou outro status que indique que virou oportunidade
        updatedAt: new Date()
      }
    })

    return { success: true, opportunity }

  } catch (error) {
    console.error('Erro ao criar oportunidade a partir do lead:', error)
    return { success: false, error: 'Erro interno do servidor' }
  }
}

/**
 * Atualiza o lead quando a oportunidade muda de estágio
 */
export async function syncLeadWithOpportunity(opportunityId: string, newStage: OpportunityStage) {
  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      include: { lead: true }
    })

    if (!opportunity) return

    let leadStatus = opportunity.lead.status

    // Mapeia estágios da oportunidade para status do lead
    switch (newStage) {
      case OpportunityStage.NEW:
      case OpportunityStage.QUALIFICATION:
        leadStatus = 'QUALIFIED'
        break
      case OpportunityStage.DISCOVERY:
      case OpportunityStage.PROPOSAL:
      case OpportunityStage.NEGOTIATION:
        leadStatus = 'IN_PROGRESS'
        break
      case OpportunityStage.WON:
        leadStatus = 'CONVERTED'
        break
      case OpportunityStage.LOST:
        leadStatus = 'LOST'
        break
    }

    await prisma.lead.update({
      where: { id: opportunity.leadId },
      data: {
        status: leadStatus,
        updatedAt: new Date()
      }
    })

  } catch (error) {
    console.error('Erro ao sincronizar lead com oportunidade:', error)
  }
}

/**
 * Busca ou cria uma oportunidade para um lead
 * Garante que sempre há uma oportunidade ativa para trabalhar
 */
export async function getOrCreateOpportunityForLead(leadId: string, ownerId: string) {
  try {
    // Primeiro tenta buscar oportunidade existente
    let opportunity = await prisma.opportunity.findFirst({
      where: {
        leadId,
        stage: { not: OpportunityStage.LOST } // Não considera oportunidades perdidas
      },
      include: {
        lead: true,
        owner: true,
        _count: { select: { tasks: true } }
      }
    })

    // Se não existe, cria uma nova
    if (!opportunity) {
      const result = await createOpportunityFromLead({ leadId, ownerId })
      if (result.success) {
        opportunity = result.opportunity
      }
    }

    return opportunity

  } catch (error) {
    console.error('Erro ao buscar/criar oportunidade para lead:', error)
    return null
  }
}