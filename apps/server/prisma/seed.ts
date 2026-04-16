import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminShortId = process.env.ADMIN_SHORTID ?? 'admin_init';

  const existing = await prisma.user.findUnique({ where: { shortId: adminShortId } });
  if (existing) {
    console.log(`✅  Admin already exists: ${adminShortId}`);
    return;
  }

  const admin = await prisma.user.create({
    data: {
      shortId:     adminShortId,
      displayName: 'Admin',
      username:    'admin',
      isAdmin:     true,
    },
  });

  console.log(`\n🔑  Admin created!`);
  console.log(`    Display name : ${admin.displayName}`);
  console.log(`    Login ID     : ${admin.shortId}`);
  console.log(`\n    Keep this ID secret — it's the admin login key.\n`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
