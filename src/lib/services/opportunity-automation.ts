import { OpportunityStage, LossReason } from '@/lib/types/opportunity'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types/auth'

export interface AutomationTrigger {
  opportunityId: string
  stageFrom?: OpportunityStage
  stageTo: OpportunityStage
  userId: string
  userRole: UserRole
  amountBr?: number
}

export interface TaskSuggestion {
  title: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  dueAt: Date
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'PROPOSAL' | 'OTHER'
}

export interface NotificationData {
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR'
  title: string
  message: string
  recipientIds: string[]
  metadata?: Record<string, any>
}

export class OpportunityAutomationService {
  /**
   * Execute automations when opportunity stage changes
   */
  static async executeStageChangeAutomations(trigger: AutomationTrigger) {
    const automations = []

    // Generate suggested tasks
    const taskSuggestions = this.generateTaskSuggestions(trigger)
    if (taskSuggestions.length > 0) {
      automations.push(this.createSuggestedTasks(trigger.opportunityId, trigger.userId, taskSuggestions))
    }

    // Generate notifications
    const notifications = await this.generateNotifications(trigger)
    if (notifications.length > 0) {
      automations.push(this.sendNotifications(notifications))
    }

    // Update lead status if needed
    automations.push(this.updateLeadStatus(trigger))

    // Check for stale opportunities
    automations.push(this.checkStaleOpportunities(trigger.userId))

    // Execute all automations
    await Promise.all(automations)
  }

  /**
   * Generate task suggestions based on stage transition
   */
  private static generateTaskSuggestions(trigger: AutomationTrigger): TaskSuggestion[] {
    const suggestions: TaskSuggestion[] = []
    const now = new Date()

    switch (trigger.stageTo) {
      case OpportunityStage.QUALIFICATION:
        suggestions.push({
          title: 'Call de qualificação',
          description: 'Realizar call para qualificar necessidades e budget do prospect',
          priority: 'HIGH',
          dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 1 day
          type: 'CALL',
        })
        suggestions.push({
          title: 'Enviar questionário de descoberta',
          description: 'Enviar questionário para mapear dores e necessidades',
          priority: 'MEDIUM',
          dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days
          type: 'EMAIL',
        })
        break

      case OpportunityStage.DISCOVERY:
        suggestions.push({
          title: 'Mapear dores e necessidades',
          description: 'Sessão de discovery para entender profundamente os desafios',
          priority: 'HIGH',
          dueAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
          type: 'MEETING',
        })
        suggestions.push({
          title: 'Identificar decision makers',
          description: 'Mapear todos os envolvidos na decisão de compra',
          priority: 'HIGH',
          dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
          type: 'OTHER',
        })
        break

      case OpportunityStage.PROPOSAL:
        suggestions.push({
          title: 'Preparar proposta comercial',
          description: 'Elaborar proposta detalhada com pricing e termos',
          priority: 'HIGH',
          dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
          type: 'PROPOSAL',
        })
        suggestions.push({
          title: 'Agendar apresentação da proposta',
          description: 'Agendar meeting para apresentar a proposta ao cliente',
          priority: 'HIGH',
          dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
          type: 'MEETING',
        })
        break

      case OpportunityStage.NEGOTIATION:
        suggestions.push({
          title: 'Preparar contrato',
          description: 'Elaborar minuta do contrato com termos acordados',
          priority: 'HIGH',
          dueAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days
          type: 'OTHER',
        })
        suggestions.push({
          title: 'Call de fechamento',
          description: 'Agendar call final para fechar o negócio',
          priority: 'HIGH',
          dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days
          type: 'CALL',
        })
        break

      case OpportunityStage.WON:
        suggestions.push({
          title: 'Onboarding do cliente',
          description: 'Iniciar processo de onboarding e implementação',
          priority: 'HIGH',
          dueAt: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day
          type: 'OTHER',
        })
        suggestions.push({
          title: 'Follow-up pós-venda',
          description: 'Agendar follow-up para garantir satisfação do cliente',
          priority: 'MEDIUM',
          dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days
          type: 'FOLLOW_UP',
        })
        break
    }

    return suggestions
  }

  /**
   * Create suggested tasks in the database
   */
  private static async createSuggestedTasks(
    opportunityId: string,
    userId: string,
    suggestions: TaskSuggestion[]
  ) {
    try {
      const tasks = suggestions.map(suggestion => ({
        title: suggestion.title,
        description: suggestion.description,
        priority: suggestion.priority,
        dueAt: suggestion.dueAt,
        type: suggestion.type,
        status: 'PENDING',
        assigneeId: userId,
        opportunityId,
        createdById: userId,
      }))

      await prisma.task.createMany({
        data: tasks,
      })
    } catch (error) {
      console.error('Error creating suggested tasks:', error)
    }
  }

  /**
   * Generate notifications for stage changes
   */
  private static async generateNotifications(trigger: AutomationTrigger): Promise<NotificationData[]> {
    const notifications: NotificationData[] = []

    try {
      // Get opportunity details
      const opportunity = await prisma.opportunity.findUnique({
        where: { id: trigger.opportunityId },
        include: {
          lead: {
            select: {
              name: true,
              company: true,
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      })

      if (!opportunity) return notifications

      const leadName = opportunity.lead.name
      const company = opportunity.lead.company || ''
      const amount = trigger.amountBr ? `R$ ${trigger.amountBr.toLocaleString()}` : ''

      // Notify owner about stage change
      if (trigger.stageFrom && trigger.stageTo !== trigger.stageFrom) {
        notifications.push({
          type: 'INFO',
          title: 'Oportunidade atualizada',
          message: `${leadName} ${company} movida de ${trigger.stageFrom} para ${trigger.stageTo}`,
          recipientIds: [opportunity.ownerId],
          metadata: {
            opportunityId: trigger.opportunityId,
            stage: trigger.stageTo,
          },
        })
      }

      // Notify managers about high-value deals
      if (trigger.amountBr && trigger.amountBr >= 50000) {
        const managers = await prisma.user.findMany({
          where: {
            role: { in: ['MANAGER', 'ADMIN'] },
            isActive: true,
          },
          select: { id: true },
        })

        if (managers.length > 0) {
          notifications.push({
            type: 'INFO',
            title: 'Deal de alto valor',
            message: `Oportunidade de ${amount} (${leadName}) movida para ${trigger.stageTo}`,
            recipientIds: managers.map(m => m.id),
            metadata: {
              opportunityId: trigger.opportunityId,
              amount: trigger.amountBr,
              stage: trigger.stageTo,
            },
          })
        }
      }

      // Notify about won deals
      if (trigger.stageTo === OpportunityStage.WON) {
        notifications.push({
          type: 'SUCCESS',
          title: '🎉 Deal fechado!',
          message: `${leadName} ${company} - ${amount} fechado com sucesso!`,
          recipientIds: [opportunity.ownerId],
          metadata: {
            opportunityId: trigger.opportunityId,
            amount: trigger.amountBr,
          },
        })

        // Notify team about wins
        const teamMembers = await prisma.user.findMany({
          where: {
            isActive: true,
            id: { not: opportunity.ownerId },
          },
          select: { id: true },
        })

        if (teamMembers.length > 0) {
          notifications.push({
            type: 'SUCCESS',
            title: 'Novo fechamento!',
            message: `${opportunity.owner.name} fechou ${leadName} - ${amount}`,
            recipientIds: teamMembers.map(m => m.id),
            metadata: {
              opportunityId: trigger.opportunityId,
              ownerId: opportunity.ownerId,
              amount: trigger.amountBr,
            },
          })
        }
      }

      // Notify about lost deals with high value
      if (trigger.stageTo === OpportunityStage.LOST && trigger.amountBr && trigger.amountBr >= 20000) {
        const managers = await prisma.user.findMany({
          where: {
            role: { in: ['MANAGER', 'ADMIN'] },
            isActive: true,
          },
          select: { id: true },
        })

        if (managers.length > 0) {
          notifications.push({
            type: 'WARNING',
            title: 'Deal de alto valor perdido',
            message: `Oportunidade de ${amount} (${leadName}) foi perdida`,
            recipientIds: managers.map(m => m.id),
            metadata: {
              opportunityId: trigger.opportunityId,
              amount: trigger.amountBr,
              ownerId: opportunity.ownerId,
            },
          })
        }
      }

      return notifications
    } catch (error) {
      console.error('Error generating notifications:', error)
      return []
    }
  }

  /**
   * Send notifications (placeholder - implement with your notification system)
   */
  private static async sendNotifications(notifications: NotificationData[]) {
    // TODO: Implement with your notification system (email, push, etc.)
    console.log('Notifications to send:', notifications)
  }

  /**
   * Update lead status based on opportunity stage
   */
  private static async updateLeadStatus(trigger: AutomationTrigger) {
    try {
      let leadStatus = 'QUALIFIED'

      switch (trigger.stageTo) {
        case OpportunityStage.QUALIFICATION:
          leadStatus = 'QUALIFIED'
          break
        case OpportunityStage.PROPOSAL:
          leadStatus = 'PROPOSAL'
          break
        case OpportunityStage.WON:
          leadStatus = 'WON'
          break
        case OpportunityStage.LOST:
          leadStatus = 'LOST'
          break
        default:
          leadStatus = 'QUALIFIED'
      }

      const opportunity = await prisma.opportunity.findUnique({
        where: { id: trigger.opportunityId },
        select: { leadId: true },
      })

      if (opportunity) {
        await prisma.lead.update({
          where: { id: opportunity.leadId },
          data: { status: leadStatus },
        })
      }
    } catch (error) {
      console.error('Error updating lead status:', error)
    }
  }

  /**
   * Check for stale opportunities and create alerts
   */
  private static async checkStaleOpportunities(userId: string) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      const staleOpportunities = await prisma.opportunity.findMany({
        where: {
          ownerId: userId,
          stage: {
            notIn: [OpportunityStage.WON, OpportunityStage.LOST],
          },
          updatedAt: {
            lt: thirtyDaysAgo,
          },
        },
        include: {
          lead: {
            select: {
              name: true,
              company: true,
            },
          },
        },
      })

      if (staleOpportunities.length > 0) {
        // Create task to review stale opportunities
        await prisma.task.create({
          data: {
            title: `Revisar ${staleOpportunities.length} oportunidades paradas`,
            description: 'Algumas oportunidades não foram atualizadas há mais de 30 dias',
            priority: 'MEDIUM',
            dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            type: 'OTHER',
            status: 'PENDING',
            assigneeId: userId,
            createdById: userId,
          },
        })
      }
    } catch (error) {
      console.error('Error checking stale opportunities:', error)
    }
  }

  /**
   * Auto-assign opportunities based on rules
   */
  static async autoAssignOpportunity(opportunityId: string, leadSource?: string) {
    try {
      // Get available sales users
      const salesUsers = await prisma.user.findMany({
        where: {
          role: 'SALES',
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              opportunities: {
                where: {
                  stage: {
                    notIn: [OpportunityStage.WON, OpportunityStage.LOST],
                  },
                },
              },
            },
          },
        },
      })

      if (salesUsers.length === 0) return

      // Simple round-robin assignment (assign to user with fewer active opportunities)
      salesUsers.sort((a, b) => a._count.opportunities - b._count.opportunities)
      const assignedUser = salesUsers[0]

      await prisma.opportunity.update({
        where: { id: opportunityId },
        data: { ownerId: assignedUser.id },
      })

      // Create welcome task
      await prisma.task.create({
        data: {
          title: 'Nova oportunidade atribuída',
          description: 'Fazer primeiro contato com o prospect',
          priority: 'HIGH',
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
          type: 'CALL',
          status: 'PENDING',
          assigneeId: assignedUser.id,
          opportunityId,
          createdById: assignedUser.id,
        },
      })
    } catch (error) {
      console.error('Error auto-assigning opportunity:', error)
    }
  }

  /**
   * Calculate opportunity score for prioritization
   */
  static calculateOpportunityScore(opportunity: {
    amountBr?: number
    probability?: number
    stage: OpportunityStage
    expectedCloseAt?: Date
    createdAt: Date
  }): number {
    let score = 0

    // Amount score (0-40 points)
    if (opportunity.amountBr) {
      score += Math.min((opportunity.amountBr / 50000) * 40, 40)
    }

    // Probability score (0-30 points)
    if (opportunity.probability) {
      score += (opportunity.probability / 100) * 30
    }

    // Stage score (0-20 points)
    const stageScores = {
      [OpportunityStage.NEW]: 5,
      [OpportunityStage.QUALIFICATION]: 8,
      [OpportunityStage.DISCOVERY]: 12,
      [OpportunityStage.PROPOSAL]: 16,
      [OpportunityStage.NEGOTIATION]: 20,
      [OpportunityStage.WON]: 0,
      [OpportunityStage.LOST]: 0,
    }
    score += stageScores[opportunity.stage] || 0

    // Urgency score (0-10 points)
    if (opportunity.expectedCloseAt) {
      const daysToClose = Math.floor(
        (opportunity.expectedCloseAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      if (daysToClose <= 7) {
        score += 10
      } else if (daysToClose <= 30) {
        score += 7
      } else if (daysToClose <= 90) {
        score += 5
      }
    }

    return Math.round(score)
  }
}