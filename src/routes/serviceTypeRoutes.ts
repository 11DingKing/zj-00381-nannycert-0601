import { Router, Request, Response } from "express";
import * as serviceTypeService from "../services/serviceTypeService";
import { ServiceType, SkillLevel } from "../models/types";

const router = Router();

function getWorkerIdParam(req: Request): number {
  return parseInt(req.params.workerId as string);
}

router.get("/", (_req: Request, res: Response) => {
  const configs = serviceTypeService.listServiceTypeConfigs();
  res.json(configs);
});

router.get("/:type", (req: Request, res: Response) => {
  const config = serviceTypeService.getServiceTypeConfig(
    req.params.type as ServiceType,
  );
  if (!config) {
    res.status(404).json({ error: "服务类型不存在" });
    return;
  }
  res.json(config);
});

router.put("/:type/required-level", (req: Request, res: Response) => {
  const { requiredLevel } = req.body;
  if (!requiredLevel || !Object.values(SkillLevel).includes(requiredLevel)) {
    res.status(400).json({ error: "无效的等级" });
    return;
  }
  const config = serviceTypeService.updateServiceTypeRequiredLevel(
    req.params.type as ServiceType,
    requiredLevel as SkillLevel,
  );
  if (!config) {
    res.status(404).json({ error: "服务类型不存在" });
    return;
  }
  res.json(config);
});

router.get("/:type/can-take/:workerId", (req: Request, res: Response) => {
  const result = serviceTypeService.canTakeOrder(
    getWorkerIdParam(req),
    req.params.type as ServiceType,
  );
  res.json(result);
});

export default router;
