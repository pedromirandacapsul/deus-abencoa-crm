// Opportunity Stage Enum
export enum OpportunityStage {
  NEW = 'NEW',
  QUALIFICATION = 'QUALIFICATION',
  DISCOVERY = 'DISCOVERY',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
}

// Loss Reason Enum
export enum LossReason {
  SEM_BUDGET = 'SEM_BUDGET',
  SEM_FIT = 'SEM_FIT',
  CONCORRENCIA = 'CONCORRENCIA',
  TIMING = 'TIMING',
  NAO_RESPONDE = 'NAO_RESPONDE',
  OUTROS = 'OUTROS',
}

// Stage Labels for UI
export const StageLabels: Record<OpportunityStage, string> = {
  [OpportunityStage.NEW]: 'Novo',
  [OpportunityStage.QUALIFICATION]: 'Qualificação',
  [OpportunityStage.DISCOVERY]: 'Descoberta',
  [OpportunityStage.PROPOSAL]: 'Proposta',
  [OpportunityStage.NEGOTIATION]: 'Negociação',
  [OpportunityStage.WON]: 'Ganho',
  [OpportunityStage.LOST]: 'Perdido',
}

// Loss Reason Labels for UI
export const LossReasonLabels: Record<LossReason, string> = {
  [LossReason.SEM_BUDGET]: 'Sem Orçamento',
  [LossReason.SEM_FIT]: 'Sem Fit',
  [LossReason.CONCORRENCIA]: 'Concorrência',
  [LossReason.TIMING]: 'Timing',
  [LossReason.NAO_RESPONDE]: 'Não Responde',
  [LossReason.OUTROS]: 'Outros',
}

// Stage Colors for Kanban
export const StageColors: Record<OpportunityStage, string> = {
  [OpportunityStage.NEW]: '#6B7280',
  [OpportunityStage.QUALIFICATION]: '#F59E0B',
  [OpportunityStage.DISCOVERY]: '#3B82F6',
  [OpportunityStage.PROPOSAL]: '#8B5CF6',
  [OpportunityStage.NEGOTIATION]: '#F97316',
  [OpportunityStage.WON]: '#10B981',
  [OpportunityStage.LOST]: '#EF4444',
}

// Opportunity Types
export interface OpportunityItem {
  id: string
  opportunityId: string
  productName: string
  qty: number
  unitPriceBr: number
  subtotalBr: number
  createdAt: Date
  updatedAt: Date
}

export interface StageHistoryEntry {
  id: string
  opportunityId: string
  stageFrom: string | null
  stageTo: string
  changedBy: string
  changedAt: Date
  user: {
    id: string
    name: string
  }
}

export interface Opportunity {
  id: string
  leadId: string
  ownerId: string
  stage: OpportunityStage
  amountBr: number | null
  currency: string
  probability: number
  expectedCloseAt: Date | null
  discountPct: number | null
  costEstimatedBr: number | null
  lostReason: LossReason | null
  createdAt: Date
  updatedAt: Date
  closedAt: Date | null

  // Relations
  lead: {
    id: string
    name: string
    email: string | null
    phone: string | null
    company: string | null
    source: string | null
  }
  owner: {
    id: string
    name: string
    email: string
  }
  items?: OpportunityItem[]
  stageHistory?: StageHistoryEntry[]
  tasks?: any[]
}

// API Request/Response Types
export interface CreateOpportunityRequest {
  leadId: string
  ownerId: string
  stage?: OpportunityStage
  amountBr?: number
  expectedCloseAt?: string
  discountPct?: number
  costEstimatedBr?: number
}

export interface UpdateOpportunityRequest {
  stage?: OpportunityStage
  amountBr?: number
  probability?: number
  expectedCloseAt?: string
  discountPct?: number
  costEstimatedBr?: number
  lostReason?: LossReason
}

export interface TransitionStageRequest {
  stageTo: OpportunityStage
  lostReason?: LossReason
  amountBr?: number
}

export interface CreateOpportunityItemRequest {
  productName: string
  qty: number
  unitPriceBr: number
}

// Analytics Types
export interface OpportunityAnalytics {
  performance: {
    conversionRate: number
    averageTicket: number
    averageClosingTime: number
    totalRevenue: number
    completedTasks: number
    callsMade: number
    messagesSent: number
    emailsSent: number
  }
  pipeline: {
    activePipeline: number
    closedRevenue: number
    lostRevenue: number
    weightedProjection30d: number
  }
  funnel: {
    stages: Array<{
      stage: OpportunityStage
      count: number
      conversionRate: number
      averageTime: number
    }>
  }
  lossReasons: Array<{
    reason: LossReason
    count: number
    percentage: number
    lostRevenue: number
  }>
  sourceQuality: Array<{
    source: string
    totalLeads: number
    opportunitiesCreated: number
    wonCount: number
    wonSumAmount: number
    conversionRate: number
    averageTicket: number
  }>
}

// Stage Validation Rules
export const StageRequirements = {
  [OpportunityStage.NEW]: {
    requiredFields: [],
    allowedTransitions: [OpportunityStage.QUALIFICATION, OpportunityStage.LOST],
  },
  [OpportunityStage.QUALIFICATION]: {
    requiredFields: [],
    allowedTransitions: [OpportunityStage.DISCOVERY, OpportunityStage.LOST],
  },
  [OpportunityStage.DISCOVERY]: {
    requiredFields: [],
    allowedTransitions: [OpportunityStage.PROPOSAL, OpportunityStage.LOST],
  },
  [OpportunityStage.PROPOSAL]: {
    requiredFields: ['amountBr'],
    allowedTransitions: [OpportunityStage.NEGOTIATION, OpportunityStage.WON, OpportunityStage.LOST],
  },
  [OpportunityStage.NEGOTIATION]: {
    requiredFields: ['amountBr'],
    allowedTransitions: [OpportunityStage.WON, OpportunityStage.LOST],
  },
  [OpportunityStage.WON]: {
    requiredFields: ['amountBr'],
    allowedTransitions: [],
  },
  [OpportunityStage.LOST]: {
    requiredFields: ['lostReason'],
    allowedTransitions: [],
  },
}

// Default Stage Probabilities
export const DefaultProbabilities: Record<OpportunityStage, number> = {
  [OpportunityStage.NEW]: 10,
  [OpportunityStage.QUALIFICATION]: 20,
  [OpportunityStage.DISCOVERY]: 35,
  [OpportunityStage.PROPOSAL]: 60,
  [OpportunityStage.NEGOTIATION]: 80,
  [OpportunityStage.WON]: 100,
  [OpportunityStage.LOST]: 0,
}

// Helper Functions
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount)
}

export const calculateLiquidAmount = (amountBr: number, discountPct?: number): number => {
  if (!discountPct) return amountBr
  return amountBr * (1 - discountPct / 100)
}

export const calculateGrossMargin = (liquidAmount: number, cost?: number): number => {
  if (!cost) return liquidAmount
  return liquidAmount - cost
}

export const canTransitionToStage = (
  currentStage: OpportunityStage,
  targetStage: OpportunityStage
): boolean => {
  return StageRequirements[currentStage].allowedTransitions.includes(targetStage)
}

export const isStageRequiredField = (
  stage: OpportunityStage,
  field: string
): boolean => {
  return StageRequirements[stage].requiredFields.includes(field)
}