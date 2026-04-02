import { NextRequest, NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 15000;

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url");
  const accept = request.nextUrl.searchParams.get("accept") || "*/*";

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing required 'url' query parameter." },
      { status: 400 }
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid target URL." }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http and https target URLs are allowed." },
      { status: 400 }
    );
  }

  try {
    const upstreamResponse = await fetch(parsedUrl.toString(), {
      method: "GET",
      headers: {
        Accept: accept,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const responseHeaders = new Headers();
    const passthroughHeaders = [
      "content-type",
      "content-disposition",
      "content-encoding",
      "cache-control",
      "etag",
      "last-modified",
    ];

    passthroughHeaders.forEach((header) => {
      const value = upstreamResponse.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    const body = await upstreamResponse.arrayBuffer();

    return new NextResponse(body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reach upstream WFS service.";

    return NextResponse.json(
      {
        error: "WFS proxy request failed.",
        details: message,
      },
      { status: 502 }
    );
  }
}
