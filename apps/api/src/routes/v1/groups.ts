import { Hono } from "hono";
import { auth } from "../../middleware/auth";
import { asHandler } from "../helpers";
import * as GroupController from "../../controllers/v1/GroupController";

const router = new Hono();

router.use("*", auth());

router.get("/", asHandler(GroupController.getAll));
router.get("/:fingerprint", asHandler(GroupController.getById));
router.get("/:fingerprint/events", asHandler(GroupController.getEvents));
router.get("/:fingerprint/timeline", asHandler(GroupController.getTimeline));
router.get("/:fingerprint/releases", asHandler(GroupController.getReleases));
router.get("/:fingerprint/correlated", asHandler(GroupController.getCorrelatedSignals));
router.get("/:fingerprint/status-history", asHandler(GroupController.getStatusHistory));
router.patch("/:fingerprint/assign", asHandler(GroupController.updateAssignment));
router.patch("/:fingerprint/status", asHandler(GroupController.updateStatus));
router.post("/:fingerprint/merge", asHandler(GroupController.merge));
router.post("/:fingerprint/unmerge", asHandler(GroupController.unmerge));

export default router;
