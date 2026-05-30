import { connectDB } from "@/lib/db";
import { OrdenTrabajo } from "@/lib/models/OrdenTrabajo";
import { NextRequest } from "next/server";
// jsPDF runs client-side only — this route generates the PDF on the client via
// a special response that sends the OT data as JSON; the actual PDF is built
// in the browser. Here we just serve the structured data for the PDF.
// (jsPDF cannot run in Node/Edge runtimes without a headless browser)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  const ot = await OrdenTrabajo.findById(id).lean();
  if (!ot) return Response.json({ error: "OT no encontrada" }, { status: 404 });
  return Response.json(ot);
}
