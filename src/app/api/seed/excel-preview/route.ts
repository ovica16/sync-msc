import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file") ?? "PSInst2026.xlsx";
  const sheetName = searchParams.get("sheet") ?? "Programa";
  const rows = Math.min(Number(searchParams.get("rows") ?? "5"), 20);

  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    return Response.json({ ok: false, error: `Archivo no encontrado: ${filePath}` }, { status: 404 });
  }

  const wb = XLSX.readFile(filePath, { sheetRows: rows + 5 });
  const sheets = wb.SheetNames;

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return Response.json({ ok: false, error: `Hoja "${sheetName}" no encontrada`, sheets }, { status: 404 });
  }

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];
  return Response.json({
    ok: true,
    sheets,
    headers: data[0] ?? [],
    preview: data.slice(0, rows),
  });
}
