import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("sync_session")?.value;
  const { pathname } = request.nextUrl;

  // Si no está autenticado y quiere entrar a rutas protegidas
  if (!token && (pathname.startsWith("/inicio") || pathname.startsWith("/ordenes"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Si ya está autenticado y quiere ir a la página de login, lo redirigimos a órdenes
  if (token && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/ordenes";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
