import { NextResponse, type NextRequest } from "next/server";

function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
}

async function proxy(req: NextRequest, pathParts: string[]) {
  const joinedPath = pathParts.join("/");
  // Do NOT force a trailing slash — FastAPI returns 307 redirect if we do,
  // which causes "detached ArrayBuffer" crash in the proxy body reader.
  const upstreamUrl = new URL(
    `${getBackendBaseUrl()}/api/v1/${joinedPath}${req.nextUrl.search}`
  );

  const headers = new Headers(req.headers);
  headers.delete("host");

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  // Read body once and store in a buffer so it can be reused if needed
  const bodyBuffer = hasBody ? await req.arrayBuffer() : undefined;
  const body = bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined;

  const upstreamRes = await fetch(upstreamUrl, {
    method,
    headers,
    body,
    // "manual" lets us handle redirects ourselves without re-reading the body
    redirect: "manual",
  });

  // If FastAPI returns a 3xx redirect, follow it manually without a body (safe)
  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    const location = upstreamRes.headers.get("location");
    if (location) {
      const redirectUrl = location.startsWith("http")
        ? new URL(location)
        : new URL(`${getBackendBaseUrl()}${location}`);
      const redirectRes = await fetch(redirectUrl, {
        method,
        headers,
        body,
        redirect: "follow",
      });
      const resHeaders2 = new Headers(redirectRes.headers);
      resHeaders2.delete("content-encoding");
      resHeaders2.delete("transfer-encoding");
      resHeaders2.delete("connection");
      return new NextResponse(redirectRes.body, {
        status: redirectRes.status,
        headers: resHeaders2,
      });
    }
  }

  const resHeaders = new Headers(upstreamRes.headers);
  // Avoid headers Next.js may not allow to set explicitly
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
