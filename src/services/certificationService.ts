import { getDb } from "../database/database";
import {
  Certification,
  CertificationStatus,
  SkillLevel,
  ServiceType,
  WorkerStatus,
} from "../models/types";
import { getWorker, updateWorkerStatus } from "./workerService";

export interface ApplyCertificationDto {
  workerId: number;
  serviceType: ServiceType;
  level: SkillLevel;
  trainingCertificate: string;
  practicalAssessmentRecord: string;
}

export interface ReviewCertificationDto {
  passed: boolean;
  validYears?: number;
}

function rowToCertification(row: any): Certification {
  return {
    id: row.id,
    workerId: row.worker_id,
    serviceType: row.service_type as ServiceType,
    level: row.level as SkillLevel,
    trainingCertificate: row.training_certificate,
    practicalAssessmentRecord: row.practical_assessment_record,
    status: row.status as CertificationStatus,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    reviewCount: row.review_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function applyCertification(dto: ApplyCertificationDto): Certification {
  const db = getDb();
  const worker = getWorker(dto.workerId);

  if (!worker) {
    throw new Error("家政人员不存在");
  }

  if (worker.status === WorkerStatus.FROZEN) {
    throw new Error("该人员已被冻结，无法申请认证");
  }

  if (worker.status === WorkerStatus.PENDING_REVIEW) {
    throw new Error("该人员尚未审核通过，无法申请认证");
  }

  const serviceTypes = JSON.parse(worker.serviceTypes) as ServiceType[];
  if (!serviceTypes.includes(dto.serviceType)) {
    throw new Error("该人员未登记此服务类型");
  }

  const existingPending = db
    .prepare(
      `
    SELECT id FROM certifications 
    WHERE worker_id = ? AND service_type = ? AND level = ? AND status = 'pending'
  `,
    )
    .get(dto.workerId, dto.serviceType, dto.level);

  if (existingPending) {
    throw new Error("该等级认证申请已存在，正在审核中");
  }

  const stmt = db.prepare(`
    INSERT INTO certifications (worker_id, service_type, level, training_certificate, practical_assessment_record, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    dto.workerId,
    dto.serviceType,
    dto.level,
    dto.trainingCertificate,
    dto.practicalAssessmentRecord,
    CertificationStatus.PENDING,
  );

  const cert = db
    .prepare("SELECT * FROM certifications WHERE id = ?")
    .get(result.lastInsertRowid);
  return rowToCertification(cert);
}

export function getCertification(id: number): Certification | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM certifications WHERE id = ?").get(id);
  return row ? rowToCertification(row) : null;
}

export function getWorkerCertifications(workerId: number): Certification[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM certifications WHERE worker_id = ? ORDER BY created_at DESC",
    )
    .all(workerId);
  return rows.map(rowToCertification);
}

export function getValidCertification(
  workerId: number,
  serviceType: ServiceType,
): Certification | null {
  const db = getDb();
  const now = new Date().toISOString();

  const row = db
    .prepare(
      `
    SELECT * FROM certifications 
    WHERE worker_id = ? 
      AND service_type = ? 
      AND status = 'approved'
      AND expires_at > ?
    ORDER BY level DESC
    LIMIT 1
  `,
    )
    .get(workerId, serviceType, now);

  return row ? rowToCertification(row) : null;
}

export function reviewCertification(
  id: number,
  dto: ReviewCertificationDto,
): Certification | null {
  const db = getDb();
  const cert = getCertification(id);

  if (!cert) return null;
  if (cert.status !== CertificationStatus.PENDING) {
    throw new Error("只有待审核的认证才能评审");
  }

  const validYears = dto.validYears || 3;

  if (dto.passed) {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + validYears);

    db.prepare(
      `
      UPDATE certifications 
      SET status = 'approved', issued_at = ?, expires_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(issuedAt, expiresAt.toISOString(), id);

    const worker = getWorker(cert.workerId);
    if (worker && worker.status === WorkerStatus.ACTIVE) {
      updateWorkerStatus(cert.workerId, WorkerStatus.CERTIFIED);
    }
  } else {
    db.prepare(
      `
      UPDATE certifications 
      SET status = 'rejected', updated_at = datetime('now')
      WHERE id = ?
    `,
    ).run(id);
  }

  return getCertification(id);
}

export function renewCertification(
  id: number,
  validYears: number = 3,
): Certification | null {
  const db = getDb();
  const cert = getCertification(id);

  if (!cert) return null;

  if (
    cert.status !== CertificationStatus.APPROVED &&
    cert.status !== CertificationStatus.EXPIRED
  ) {
    throw new Error("只有已通过或已过期的认证才能复审");
  }

  const now = new Date();
  const newExpiresAt = new Date();
  newExpiresAt.setFullYear(now.getFullYear() + validYears);

  db.prepare(
    `
    UPDATE certifications 
    SET status = 'approved', 
        issued_at = ?, 
        expires_at = ?, 
        review_count = review_count + 1,
        updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(now.toISOString(), newExpiresAt.toISOString(), id);

  const worker = getWorker(cert.workerId);
  if (worker && worker.status === WorkerStatus.ACTIVE) {
    updateWorkerStatus(cert.workerId, WorkerStatus.CERTIFIED);
  }

  return getCertification(id);
}

export function expireCertifications(): number {
  const db = getDb();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `
    UPDATE certifications 
    SET status = 'expired', updated_at = datetime('now')
    WHERE status = 'approved' AND expires_at <= ?
  `,
    )
    .run(now);

  return result.changes;
}

export function listCertifications(
  serviceType?: ServiceType,
  level?: SkillLevel,
  status?: CertificationStatus,
  page: number = 1,
  pageSize: number = 20,
): { certifications: Certification[]; total: number } {
  const db = getDb();
  let query = "SELECT * FROM certifications";
  let countQuery = "SELECT COUNT(*) as count FROM certifications";
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (serviceType) {
    whereClauses.push("service_type = ?");
    params.push(serviceType);
  }
  if (level) {
    whereClauses.push("level = ?");
    params.push(level);
  }
  if (status) {
    whereClauses.push("status = ?");
    params.push(status);
  }

  if (whereClauses.length > 0) {
    const whereSql = " WHERE " + whereClauses.join(" AND ");
    query += whereSql;
    countQuery += whereSql;
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, (page - 1) * pageSize);

  const certifications = db
    .prepare(query)
    .all(...params)
    .map(rowToCertification);
  const totalRow = db
    .prepare(countQuery)
    .get(...params.slice(0, params.length - 2)) as any;

  return { certifications, total: totalRow.count };
}
