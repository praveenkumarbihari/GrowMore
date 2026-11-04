import { NextRequest, NextResponse } from "next/server";

export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

/** HTTP Basic auth. Password comes from ADMIN_PASSWORD; unset means admin is closed. */
export function middleware(req: NextRequest) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return new NextResponse("Admin is not configured.", { status: 503 });
  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(":") + 1);
      if (given === pw) return NextResponse.next();
    } catch {
      /* fall through */
    }
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}
