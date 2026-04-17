import { Hono } from "hono";
import { apiKeyMiddleware } from "../../middleware/api-key";
import * as EnvelopeController from "../../controllers/v1/EnvelopeController";

const router = new Hono();

router.post("/", apiKeyMiddleware, EnvelopeController.submitEnvelope);

export default router;
