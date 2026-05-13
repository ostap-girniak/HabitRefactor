import { NextResponse, type NextRequest } from "next/server";

function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const joinedPath = pathParts.join("/");
  // Force a trailing slash unless it's a specific file (contains a dot)
  const hasExtension = joinedPath.includes('.');
  const urlPath = joinedPath + (!hasExtension && !joinedPath.endsWith('/') ? '/' : '');

  const upstreamUrl = new URL(
    `${getBackendBaseUrl()}/api/v1/${urlPath}${req.nextUrl.search}`
  );

  const headers = new Headers(req.headers);
  headers.delete("host");

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const upstreamRes = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    redirect: "follow",
  });

  const resHeaders = new Headers(upstreamRes.headers);
  // Avoid sending headers Next.js may not allow to set explicitly
  resHeaders.delete("content-encoding");
  resHeaders.delete("transfer-encoding");
  resHeaders.delete("connection");

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: resHeaders,
  });
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}

export async function OPTIONS(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  return proxy(req, path);
}
