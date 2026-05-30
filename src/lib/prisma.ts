import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

type GlobalPrisma = { prisma?: PrismaClient };
const g = globalThis as unknown as GlobalPrisma;

function getClient(): PrismaClient {
  if (!g.prisma) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no está configurada");
    g.prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
      log: process.env.NODE_ENV === "development" ? ["error"] : [],
    });
  }
  return g.prisma;
}

// Proxy para inicialización lazy — no lanza error en build si DATABASE_URL falta
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
