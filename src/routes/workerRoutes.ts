import { Router, Request, Response } from "express";
import * as workerService from "../services/workerService";
import { WorkerStatus, ServiceType } from "../models/types";

const router = Router();

function getIdParam(req: Request): number {
  return parseInt(req.params.id as string);
}

router.post("/", (req: Request, res: Response) => {
  try {
    const worker = workerService.createWorker(req.body);
    res.status(201).json(worker);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/", (req: Request, res: Response) => {
  const { status, page = "1", pageSize = "20" } = req.query;
  const result = workerService.listWorkers(
    status as WorkerStatus | undefined,
    parseInt(page as string),
    parseInt(pageSize as string),
  );
  res.json(result);
});

router.get("/:id", (req: Request, res: Response) => {
  const worker = workerService.getWorker(getIdParam(req));
  if (!worker) {
    res.status(404).json({ error: "家政人员不存在" });
    return;
  }
  res.json(worker);
});

router.put("/:id", (req: Request, res: Response) => {
  const worker = workerService.updateWorker(getIdParam(req), req.body);
  if (!worker) {
    res.status(404).json({ error: "家政人员不存在" });
    return;
  }
  res.json(worker);
});

router.post("/:id/approve", (req: Request, res: Response) => {
  try {
    const worker = workerService.approveWorker(getIdParam(req));
    if (!worker) {
      res.status(404).json({ error: "家政人员不存在" });
      return;
    }
    res.json(worker);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/freeze", (req: Request, res: Response) => {
  try {
    const worker = workerService.freezeWorker(getIdParam(req));
    if (!worker) {
      res.status(404).json({ error: "家政人员不存在" });
      return;
    }
    res.json(worker);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/unfreeze", (req: Request, res: Response) => {
  try {
    const worker = workerService.unfreezeWorker(getIdParam(req));
    if (!worker) {
      res.status(404).json({ error: "家政人员不存在" });
      return;
    }
    res.json(worker);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete("/:id", (req: Request, res: Response) => {
  const success = workerService.deleteWorker(getIdParam(req));
  if (!success) {
    res.status(404).json({ error: "家政人员不存在" });
    return;
  }
  res.json({ success: true });
});

router.get("/:id/profile", (req: Request, res: Response) => {
  const profile = workerService.getWorkerProfile(getIdParam(req));
  if (!profile) {
    res.status(404).json({ error: "家政人员不存在" });
    return;
  }
  res.json(profile);
});

router.get("/:id/eligibility/:serviceType", (req: Request, res: Response) => {
  const eligibility = workerService.getServiceTypeEligibility(
    getIdParam(req),
    req.params.serviceType as ServiceType,
  );
  res.json(eligibility);
});

router.get(
  "/eligibility/:serviceType/eligible",
  (req: Request, res: Response) => {
    const { page = "1", pageSize = "20" } = req.query;
    const result = workerService.getWorkersByEligibility(
      req.params.serviceType as ServiceType,
      true,
      parseInt(page as string),
      parseInt(pageSize as string),
    );
    res.json(result);
  },
);

router.get(
  "/eligibility/:serviceType/ineligible",
  (req: Request, res: Response) => {
    const { page = "1", pageSize = "20" } = req.query;
    const result = workerService.getWorkersByEligibility(
      req.params.serviceType as ServiceType,
      false,
      parseInt(page as string),
      parseInt(pageSize as string),
    );
    res.json(result);
  },
);

router.get("/remedial-training", (req: Request, res: Response) => {
  const { serviceType, page = "1", pageSize = "20" } = req.query;
  const result = workerService.getWorkersInRemedialTraining(
    serviceType as ServiceType | undefined,
    parseInt(page as string),
    parseInt(pageSize as string),
  );
  res.json(result);
});

export default router;
