import { Hono } from "hono";
import { apiKeyMiddleware } from "../../middleware/api-key";
import { auth } from "../../middleware/auth";
import { asHandler } from "../helpers";
import * as PerformanceController from "../../controllers/v1/PerformanceController";

const router = new Hono();

// SDK endpoints (API key auth)
router.post("/metrics", apiKeyMiddleware, PerformanceController.submitMetrics);
router.post("/transaction", apiKeyMiddleware, PerformanceController.submitTransaction);

// Dashboard endpoints (session auth)
router.get("/metrics", auth(), asHandler(PerformanceController.getMetrics));
router.get("/transactions", auth(), asHandler(PerformanceController.getTransactions));
router.get("/transactions/:id", auth(), asHandler(PerformanceController.getTransaction));
router.get("/slowest", auth(), asHandler(PerformanceController.getSlowestTransactions));
router.get("/span-analysis", auth(), asHandler(PerformanceController.getSpanAnalysis));
router.get("/apdex", auth(), asHandler(PerformanceController.getApdexScore));
router.get("/server-stats", auth(), asHandler(PerformanceController.getServerStats));
router.get("/top-endpoints", auth(), asHandler(PerformanceController.getTopEndpoints));
router.get("/throughput-timeline", auth(), asHandler(PerformanceController.getThroughputTimeline));
router.get("/duration-timeline", auth(), asHandler(PerformanceController.getDurationTimeline));
router.get("/external-calls", auth(), asHandler(PerformanceController.getExternalCalls));
router.get("/cache", auth(), asHandler(PerformanceController.getCache));
router.get("/queues", auth(), asHandler(PerformanceController.getQueues));
router.get("/endpoint-detail", auth(), asHandler(PerformanceController.getEndpointDetail));
router.get("/web-vitals", auth(), asHandler(PerformanceController.getWebVitals));

export default router;
