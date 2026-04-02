import { Hono } from "hono";
import * as InstanceController from "../../controllers/v1/InstanceController";

const router = new Hono();

router.get("/status", InstanceController.getStatus);
router.post("/bootstrap", InstanceController.bootstrap);

export default router;
