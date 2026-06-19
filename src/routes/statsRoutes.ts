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

export default router;
