import { prisma } from "@/lib/prisma";

export async function GET() {
  const modos = await prisma.catalogoModo.findMany({ orderBy: { codigo: "asc" } });
  return Response.json(modos);
}
