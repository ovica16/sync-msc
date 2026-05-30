import { connectDB } from "@/lib/db";
import { CatalogoModo } from "@/lib/models/ArbolFallas";

export async function GET() {
  await connectDB();
  const modos = await CatalogoModo.find({}).sort({ codigo: 1 }).lean();
  return Response.json(modos);
}
