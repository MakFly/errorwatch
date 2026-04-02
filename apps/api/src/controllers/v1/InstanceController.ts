import { z } from "zod";
import type { Context } from "hono";
import { InstanceService } from "../../services/InstanceService";

const bootstrapSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export const getStatus = async (c: Context) => {
  const status = await InstanceService.getStatus();
  return c.json(status);
};

export const bootstrap = async (c: Context) => {
  try {
    const input = bootstrapSchema.parse(await c.req.json());
    const result = await InstanceService.bootstrap(input);
    return c.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid input", details: error.issues }, 400);
    }

    if (error.message === "Bootstrap is only available in self-hosted mode") {
      return c.json({ error: error.message }, 403);
    }

    if (error.message === "Instance already initialized" || error.message === "User already exists") {
      return c.json({ error: error.message }, 409);
    }

    return c.json({ error: error.message || "Failed to bootstrap instance" }, 500);
  }
};
