import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const stageProbabilities = [
  { stage: 'NEW', probability: 10 },
  { stage: 'QUALIFICATION', probability: 20 },
  { stage: 'DISCOVERY', probability: 35 },
  { stage: 'PROPOSAL', probability: 60 },
  { stage: 'NEGOTIATION', probability: 80 },
  { stage: 'WON', probability: 100 },
  { stage: 'LOST', probability: 0 },
]

async function seedStageProbabilities() {
  console.log('🌱 Seeding stage probabilities...')

  for (const item of stageProbabilities) {
    await prisma.stageProbability.upsert({
      where: { stage: item.stage },
      update: { probability: item.probability },
      create: item,
    })
    console.log(`✓ Created/updated stage probability: ${item.stage} - ${item.probability}%`)
  }

  console.log('✅ Stage probabilities seeded successfully!')
}

seedStageProbabilities()
  .catch((e) => {
    console.error('❌ Error seeding stage probabilities:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })