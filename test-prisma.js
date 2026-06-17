require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function testPrisma() {
  try {
    const users = await prisma.users.findMany({
      select: {
        email: true,
        balance: true
      }
    });
    console.log("✅ Utilisateurs BaloPay:", users);
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPrisma();
