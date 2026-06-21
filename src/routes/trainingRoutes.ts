import { Router, Request, Response } from "express";
import * as trainingService from "../services/trainingService";
import { TrainingType, TrainingStatus, ServiceType } from "../models/types";

const router = Router();

function getIdParam(req: Request): number {
  return parseInt(req.params.id as string);
}

function getWorkerIdParam(req: Request): number {
  return parseInt(req.params.workerId as string);
}

router.post("/", (req: Request, res: Response) => {
  try {
    const training = trainingService.createTraining(req.body);
    res.status(201).json(training);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/", (req: Request, res: Response) => {
  const {
    serviceType,
    type,
    status,
    workerId,
    page = "1",
    pageSize = "20",
  } = req.query;
  const result = trainingService.listTrainings(
    serviceType as ServiceType | undefined,
    type as TrainingType | undefined,
    status as TrainingStatus | undefined,
    workerId ? parseInt(workerId as string) : undefined,
    parseInt(page as string),
    parseInt(pageSize as string),
  );
  res.json(result);
});

router.get("/:id", (req: Request, res: Response) => {
  const training = trainingService.getTraining(getIdParam(req));
  if (!training) {
    res.status(404).json({ error: "培训记录不存在" });
    return;
  }
  res.json(training);
});

router.put("/:id", (req: Request, res: Response) => {
  try {
    const training = trainingService.updateTraining(getIdParam(req), req.body);
    if (!training) {
      res.status(404).json({ error: "培训记录不存在" });
      return;
    }
    res.json(training);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/start", (req: Request, res: Response) => {
  try {
    const training = trainingService.startTraining(getIdParam(req));
    if (!training) {
      res.status(404).json({ error: "培训记录不存在" });
      return;
    }
    res.json(training);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/complete", (req: Request, res: Response) => {
  try {
    const training = trainingService.completeTraining(
      getIdParam(req),
      req.body,
    );
    if (!training) {
      res.status(404).json({ error: "培训记录不存在" });
      return;
    }
    res.json(training);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/worker/:workerId", (req: Request, res: Response) => {
  const trainings = trainingService.getWorkerTrainings(getWorkerIdParam(req));
  res.json(trainings);
});

router.get("/stats/by-service-type", (_req: Request, res: Response) => {
  const stats = trainingService.getTrainingStatsByServiceType();
  res.json(stats);
});

export default router;
