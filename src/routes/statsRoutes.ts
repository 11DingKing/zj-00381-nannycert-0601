import { Router, Request, Response } from "express";
import * as statsService from "../services/statsService";

const router = Router();

router.get("/overall", (_req: Request, res: Response) => {
  const stats = statsService.getOverallStats();
  res.json(stats);
});

router.get("/service-types", (_req: Request, res: Response) => {
  const stats = statsService.getServiceTypeStats();
  res.json(stats);
});

router.get(
  "/service-types/:type/level-distribution",
  (req: Request, res: Response) => {
    const stats = statsService.getLevelDistributionByServiceType(
      req.params.type as any,
    );
    res.json(stats);
  },
);

router.get("/certifications/status", (_req: Request, res: Response) => {
  const stats = statsService.getCertificationStatsByStatus();
  res.json(stats);
});

router.get("/operations", (req: Request, res: Response) => {
  const { expiringDays = "30" } = req.query;
  const stats = statsService.getOperationsStats(
    parseInt(expiringDays as string),
  );
  res.json(stats);
});

router.get("/operations/service-types/:type", (req: Request, res: Response) => {
  const { expiringDays = "30" } = req.query;
  const stats = statsService.getOperationsStatsByServiceType(
    req.params.type as any,
    parseInt(expiringDays as string),
  );
  if (!stats) {
    res.status(404).json({ error: "服务类型不存在" });
    return;
  }
  res.json(stats);
});

export default router;
