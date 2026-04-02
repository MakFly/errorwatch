import { NextResponse } from "next/server";

import { serializeRuntimeConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  return new NextResponse(`window.__ERRORWATCH_RUNTIME_CONFIG__ = ${serializeRuntimeConfig()};`, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
