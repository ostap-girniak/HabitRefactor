import { NextResponse, type NextRequest } from "next/server";

function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
}

// Headers that must not be forwarded (hop-by-hop) or that would cause the
// browser to double-decode an already-decoded buffer.
const STRIPPED_RESPONSE_HEADERS = new Set([
  "content-encoding",
  "transfer-encoding",
  "connection",
  "keep-alive",
  "content-length",
]);

async function proxy(req: NextRequest, pathParts: string[]) {
  const joinedPath = pathParts.join("/");
  const upstreamUrl = `${getBackendBaseUrl()}/api/v1/${joinedPath}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");

  const method = req.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await req.arrayBuffer() : undefined;

  const upstreamRes = await fetch(upstreamUrl, {
    method,
    headers,
    body: body && body.byteLength > 0 ? body : undefined,
    redirect: "follow",
  });

  // Buffer the full body. Streaming through Next.js Route Handlers in
  // production has caused responses to hang in the browser (Pending state)
  // when content-encoding / transfer-encoding flags didn't line up with the
  // actual bytes Node's fetch already decoded for us.
  const responseBuffer = await upstreamRes.arrayBuffer();

  const responseHeaders = new Headers();
  upstreamRes.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return new NextResponse(responseBuffer, {
    status: upstreamRes.status,
    headers: responseHeaders,
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
