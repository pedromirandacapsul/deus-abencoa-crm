import { OpportunityStage, LossReason, canTransitionToStage } from '@/lib/types/opportunity'
import { prisma } from '@/lib/prisma'

export interface OpportunityValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export interface OpportunityData {
  id?: string
  stage: OpportunityStage
  amountBr?: number
  probability?: number
  expectedCloseAt?: Date
  lostReason?: LossReason
  ownerId: string
  leadId: string
}

export class OpportunityValidationService {
  /**
   * Validate opportunity data before creation/update
   */
  static async validateOpportunity(
    data: OpportunityData,
    currentStage?: OpportunityStage
  ): Promise<OpportunityValidationResult> {
    const result: OpportunityValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    // Stage transition validation
    if (currentStage && data.stage !== currentStage) {
      if (!canTransitionToStage(currentStage, data.stage)) {
        result.isValid = false
        result.errors.push(`Transição de ${currentStage} para ${data.stage} não é permitida`)
      }
    }

    // Stage-specific validations
    await this.validateStageRequirements(data, result)

    // Business rules validation
    await this.validateBusinessRules(data, result)

    // Data integrity validation
    this.validateDataIntegrity(data, result)

    return result
  }

  /**
   * Validate stage-specific requirements
   */
  private static async validateStageRequirements(
    data: OpportunityData,
    result: OpportunityValidationResult
  ) {
    switch (data.stage) {
      case OpportunityStage.PROPOSAL:
        if (!data.amountBr || data.amountBr <= 0) {
          result.isValid = false
          result.errors.push('Valor da oportunidade é obrigatório para etapa de Proposta')
        }
        break

      case OpportunityStage.NEGOTIATION:
        if (!data.amountBr || data.amountBr <= 0) {
          result.isValid = false
          result.errors.push('Valor da oportunidade é obrigatório para etapa de Negociação')
        }
        if (!data.expectedCloseAt) {
          result.warnings.push('Data esperada de fechamento recomendada para etapa de Negociação')
        }
        break

      case OpportunityStage.WON:
        if (!data.amountBr || data.amountBr <= 0) {
          result.isValid = false
          result.errors.push('Valor da oportunidade é obrigatório para marcar como Ganha')
        }
        break

      case OpportunityStage.LOST:
        if (!data.lostReason) {
          result.isValid = false
          result.errors.push('Motivo da perda é obrigatório para marcar como Perdida')
        }
        break
    }
  }

  /**
   * Validate business rules
   */
  private static async validateBusinessRules(
    data: OpportunityData,
    result: OpportunityValidationResult
  ) {
    // Check for duplicate opportunities for the same lead
    if (data.leadId) {
      const existingOpportunities = await prisma.opportunity.findMany({
        where: {
          leadId: data.leadId,
          stage: {
            notIn: [OpportunityStage.WON, OpportunityStage.LOST],
          },
          ...(data.id ? { id: { not: data.id } } : {}),
        },
      })

      if (existingOpportunities.length > 0) {
        result.warnings.push('Este lead já possui oportunidades ativas')
      }
    }

    // Validate owner assignment
    if (data.ownerId) {
      const owner = await prisma.user.findUnique({
        where: { id: data.ownerId },
        select: { role: true, isActive: true },
      })

      if (!owner) {
        result.isValid = false
        result.errors.push('Usuário responsável não encontrado')
      } else if (!owner.isActive) {
        result.isValid = false
        result.errors.push('Usuário responsável não está ativo')
      } else if (owner.role === 'SALES') {
        // Check sales user workload
        const activeOpportunities = await prisma.opportunity.count({
          where: {
            ownerId: data.ownerId,
            stage: {
              notIn: [OpportunityStage.WON, OpportunityStage.LOST],
            },
          },
        })

        if (activeOpportunities >= 20) {
          result.warnings.push('Vendedor já possui muitas oportunidades ativas (20+)')
        }
      }
    }

    // Validate expected close date
    if (data.expectedCloseAt) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (data.expectedCloseAt < today) {
        if ([OpportunityStage.WON, OpportunityStage.LOST].includes(data.stage)) {
          // Allow past dates for closed opportunities
        } else {
          result.warnings.push('Data esperada de fechamento está no passado')
        }
      }

      // Warn if date is too far in the future (> 1 year)
      const oneYearFromNow = new Date()
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1)

      if (data.expectedCloseAt > oneYearFromNow) {
        result.warnings.push('Data esperada de fechamento está muito distante (> 1 ano)')
      }
    }

    // Validate amount ranges
    if (data.amountBr) {
      if (data.amountBr > 1000000) {
        result.warnings.push('Valor muito alto (> R$ 1.000.000) - verificar se está correto')
      }

      if (data.amountBr < 100) {
        result.warnings.push('Valor muito baixo (< R$ 100) - verificar se está correto')
      }
    }
  }

  /**
   * Validate data integrity
   */
  private static validateDataIntegrity(
    data: OpportunityData,
    result: OpportunityValidationResult
  ) {
    // Probability validation
    if (data.probability !== undefined) {
      if (data.probability < 0 || data.probability > 100) {
        result.isValid = false
        result.errors.push('Probabilidade deve estar entre 0 e 100')
      }

      // Warn if probability doesn't match stage expectations
      const stageExpectedProbability = this.getStageExpectedProbability(data.stage)
      if (Math.abs(data.probability - stageExpectedProbability) > 20) {
        result.warnings.push(
          `Probabilidade ${data.probability}% não condiz com a etapa ${data.stage} (esperado ~${stageExpectedProbability}%)`
        )
      }
    }

    // Lost reason validation
    if (data.lostReason && data.stage !== OpportunityStage.LOST) {
      result.warnings.push('Motivo de perda informado mas oportunidade não está marcada como perdida')
    }
  }

  /**
   * Get expected probability for a stage
   */
  private static getStageExpectedProbability(stage: OpportunityStage): number {
    const defaultProbabilities = {
      [OpportunityStage.NEW]: 10,
      [OpportunityStage.QUALIFICATION]: 20,
      [OpportunityStage.DISCOVERY]: 35,
      [OpportunityStage.PROPOSAL]: 60,
      [OpportunityStage.NEGOTIATION]: 80,
      [OpportunityStage.WON]: 100,
      [OpportunityStage.LOST]: 0,
    }

    return defaultProbabilities[stage] || 0
  }

  /**
   * Validate opportunity items
   */
  static validateOpportunityItems(items: any[]): OpportunityValidationResult {
    const result: OpportunityValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    if (!items || items.length === 0) {
      result.warnings.push('Oportunidade sem itens - considere adicionar produtos/serviços')
      return result
    }

    items.forEach((item, index) => {
      if (!item.productName || item.productName.trim() === '') {
        result.isValid = false
        result.errors.push(`Item ${index + 1}: Nome do produto é obrigatório`)
      }

      if (!item.qty || item.qty <= 0) {
        result.isValid = false
        result.errors.push(`Item ${index + 1}: Quantidade deve ser maior que zero`)
      }

      if (!item.unitPriceBr || item.unitPriceBr <= 0) {
        result.isValid = false
        result.errors.push(`Item ${index + 1}: Preço unitário deve ser maior que zero`)
      }

      if (item.unitPriceBr && item.unitPriceBr > 100000) {
        result.warnings.push(`Item ${index + 1}: Preço unitário muito alto (> R$ 100.000)`)
      }
    })

    return result
  }

  /**
   * Validate bulk operations
   */
  static async validateBulkUpdate(
    opportunityIds: string[],
    updateData: Partial<OpportunityData>
  ): Promise<OpportunityValidationResult> {
    const result: OpportunityValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    }

    if (opportunityIds.length === 0) {
      result.isValid = false
      result.errors.push('Nenhuma oportunidade selecionada')
      return result
    }

    if (opportunityIds.length > 50) {
      result.warnings.push('Operação em lote com muitas oportunidades (> 50) - pode demorar')
    }

    // Validate that all opportunities exist and can be updated
    const opportunities = await prisma.opportunity.findMany({
      where: {
        id: { in: opportunityIds },
      },
      select: {
        id: true,
        stage: true,
        ownerId: true,
      },
    })

    if (opportunities.length !== opportunityIds.length) {
      result.isValid = false
      result.errors.push('Algumas oportunidades não foram encontradas')
    }

    // Validate stage transitions if stage is being updated
    if (updateData.stage) {
      const invalidTransitions = opportunities.filter(
        opp => !canTransitionToStage(opp.stage as OpportunityStage, updateData.stage!)
      )

      if (invalidTransitions.length > 0) {
        result.isValid = false
        result.errors.push(
          `${invalidTransitions.length} oportunidades não podem ser movidas para ${updateData.stage}`
        )
      }
    }

    return result
  }
}