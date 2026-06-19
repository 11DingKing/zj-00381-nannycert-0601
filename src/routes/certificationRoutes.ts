import { Router, Request, Response } from "express";
import * as certificationService from "../services/certificationService";
import { ServiceType, SkillLevel, CertificationStatus } from "../models/types";

const router = Router();

function getIdParam(req: Request): number {
  return parseInt(req.params.id as string);
}

function getWorkerIdParam(req: Request): number {
  return parseInt(req.params.workerId as string);
}

router.post("/apply", (req: Request, res: Response) => {
  try {
    const cert = certificationService.applyCertification(req.body);
    res.status(201).json(cert);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.get("/", (req: Request, res: Response) => {
  const { serviceType, level, status, page = "1", pageSize = "20" } = req.query;
  const result = certificationService.listCertifications(
    serviceType as ServiceType | undefined,
    level as SkillLevel | undefined,
    status as CertificationStatus | undefined,
    parseInt(page as string),
    parseInt(pageSize as string),
  );
  res.json(result);
});

router.get("/:id", (req: Request, res: Response) => {
  const cert = certificationService.getCertification(getIdParam(req));
  if (!cert) {
    res.status(404).json({ error: "认证不存在" });
    return;
  }
  res.json(cert);
});

router.post("/:id/review", (req: Request, res: Response) => {
  try {
    const cert = certificationService.reviewCertification(
      getIdParam(req),
      req.body,
    );
    if (!cert) {
      res.status(404).json({ error: "认证不存在" });
      return;
    }
    res.json(cert);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/:id/renew", (req: Request, res: Response) => {
  try {
    const { validYears = 3 } = req.body;
    const cert = certificationService.renewCertification(
      getIdParam(req),
      validYears,
    );
    if (!cert) {
      res.status(404).json({ error: "认证不存在" });
      return;
    }
    res.json(cert);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/expire-batch", (req: Request, res: Response) => {
  const count = certificationService.expireCertifications();
  res.json({ expiredCount: count });
});

router.get("/worker/:workerId", (req: Request, res: Response) => {
  const certs = certificationService.getWorkerCertifications(
    getWorkerIdParam(req),
  );
  res.json(certs);
});

export default router;
