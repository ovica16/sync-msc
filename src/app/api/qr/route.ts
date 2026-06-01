import QRCode from "qrcode";
import { NextRequest } from "next/server";

// GET /api/qr?url=https://...&size=200
// Devuelve imagen PNG del QR. No requiere autenticación.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url  = searchParams.get("url");
  const size  = Math.min(Math.max(Number(searchParams.get("size") || "200"), 64), 600);

  if (!url) return new Response("Missing url", { status: 400 });

  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0d2f5e", light: "#ffffff" },
  });

  return new Response(png as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
