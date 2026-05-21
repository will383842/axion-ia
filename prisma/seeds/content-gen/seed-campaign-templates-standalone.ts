import { PrismaClient } from "../../generated/client";
import { seedCampaignTemplates } from "./seed-campaign-templates";

const prisma = new PrismaClient();

async function main() {
  const count = await seedCampaignTemplates(prisma);
  console.log(`[seed-campaign-templates] ${count} templates upserted.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
