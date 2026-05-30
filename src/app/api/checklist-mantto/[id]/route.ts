import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ChecklistMantto from "@/lib/models/ChecklistMantto";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  const body = await req.json();
  const doc = await ChecklistMantto.findByIdAndUpdate(id, body, { new: true });
  if (!doc) return NextResponse.json({ ok: false, error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, doc });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  await connectDB();
  await ChecklistMantto.findByIdAndUpdate(id, { activo: false });
  return NextResponse.json({ ok: true });
}
