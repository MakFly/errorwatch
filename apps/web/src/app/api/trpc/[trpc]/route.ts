/**
 * tRPC API Route Handler for Next.js App Router
 * @see https://trpc.io/docs/server/adapters/nextjs#route-handler
 */
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/router";
import { createTRPCContext } from "@/server/trpc/trpc";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
    onError({ error, path }) {
      console.error(`[tRPC] ${path ?? "<unknown>"}: ${error.message}`);
    },
  });

export { handler as GET, handler as POST };
