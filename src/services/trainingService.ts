import { getDb } from "../database/database";
import {
  Training,
  TrainingType,
  TrainingStatus,
  ServiceType,
  CertificationStatus,
} from "../models/types";
import { getCertification, updateCertificationStatus } from "./certificationService";
import { getWorker } from "./workerService";

export interface CreateTrainingDto {
  workerId: number;
  certificationId?: number;
  serviceType: ServiceType;
  type: TrainingType;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  trainingHours?: number;
  trainer?: string;
  notes?: string;
}

export interface UpdateTrainingDto {
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  trainingHours?: number;
  trainer?: string;
  notes?: string;
  status?: TrainingStatus;
}

export interface CompleteTrainingDto {
  practicalScore?: number;
  theoryScore?: number;
  passed: boolean;
  notes?: string;
}

function rowToTraining(row: any): Training {
  return {
    id: row.id,
    workerId: row.worker_id,
    certificationId: row.certification_id ?? undefined,
    serviceType: row.service_type as ServiceType,
    type: row.type as TrainingType,
    status: row.status as TrainingStatus,
    title: row.title,
    description: row.description ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    trainingHours: row.training_hours,
    practicalScore: row.practical_score ?? undefined,
    theoryScore: row.theory_score ?? undefined,
    trainer: row.trainer ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTraining(dto: CreateTrainingDto): Training {
  const db = getDb();

  const worker = getWorker(dto.workerId);
  if (!worker) {
    throw new Error("家政人员不存在");
  }

  if (dto.certificationId) {
    const cert = getCertification(dto.certificationId);
    if (!cert) {
      throw new Error("关联证书不存在");
    }
    if (cert.workerId !== dto.workerId) {
      throw new Error("证书与人员不匹配");
    }
  }

  const stmt = db.prepare(`
    INSERT INTO trainings (worker_id, certification_id, service_type, type, title, description, start_date, end_date, training_hours, trainer, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    dto.workerId,
    dto.certificationId ?? null,
    dto.serviceType,
    dto.type,
    dto.title,
    dto.description ?? null,
    dto.startDate ?? null,
    dto.endDate ?? null,
    dto.trainingHours ?? 0,
    dto.trainer ?? null,
    dto.notes ?? null,
  );

  const training = db
    .prepare("SELECT * FROM trainings WHERE id = ?")
    .get(result.lastInsertRowid);

  if (dto.type === TrainingType.REMEDIAL && dto.certificationId) {
    updateCertificationStatus(dto.certificationId, CertificationStatus.REMEDIAL_TRAINING);
  }

  return rowToTraining(training);
}

export function getTraining(id: number): Training | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM trainings WHERE id = ?").get(id);
  return row ? rowToTraining(row) : null;
}

export function getWorkerTrainings(workerId: number): Training[] {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM trainings WHERE worker_id = ? ORDER BY created_at DESC",
    )
    .all(workerId);
  return rows.map(rowToTraining);
}

export function getActiveTraining(
  workerId: number,
  serviceType: ServiceType,
): Training | null {
  const db = getDb();
  const row = db
    .prepare(
      `
    SELECT * FROM trainings 
    WHERE worker_id = ? 
      AND service_type = ? 
      AND status IN ('scheduled', 'in_progress')
    ORDER BY created_at DESC
    LIMIT 1
  `,
    )
    .get(workerId, serviceType);
  return row ? rowToTraining(row) : null;
}

export function updateTraining(
  id: number,
  dto: UpdateTrainingDto,
): Training | null {
  const db = getDb();
  const existing = getTraining(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (dto.title !== undefined) {
    fields.push("title = ?");
    values.push(dto.title);
  }
  if (dto.description !== undefined) {
    fields.push("description = ?");
    values.push(dto.description);
  }
  if (dto.startDate !== undefined) {
    fields.push("start_date = ?");
    values.push(dto.startDate);
  }
  if (dto.endDate !== undefined) {
    fields.push("end_date = ?");
    values.push(dto.endDate);
  }
  if (dto.trainingHours !== undefined) {
    fields.push("training_hours = ?");
    values.push(dto.trainingHours);
  }
  if (dto.trainer !== undefined) {
    fields.push("trainer = ?");
    values.push(dto.trainer);
  }
  if (dto.notes !== undefined) {
    fields.push("notes = ?");
    values.push(dto.notes);
  }
  if (dto.status !== undefined) {
    fields.push("status = ?");
    values.push(dto.status);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(
    `UPDATE trainings SET ${fields.join(", ")} WHERE id = ?`,
  );
  stmt.run(...values);

  return getTraining(id);
}

export function startTraining(id: number): Training | null {
  const existing = getTraining(id);
  if (!existing) return null;

  if (existing.status !== TrainingStatus.SCHEDULED) {
    throw new Error("只有已安排的培训才能开始");
  }

  return updateTraining(id, { status: TrainingStatus.IN_PROGRESS });
}

export function completeTraining(
  id: number,
  dto: CompleteTrainingDto,
): Training | null {
  const db = getDb();
  const existing = getTraining(id);
  if (!existing) return null;

  if (
    existing.status !== TrainingStatus.IN_PROGRESS &&
    existing.status !== TrainingStatus.SCHEDULED
  ) {
    throw new Error("该培训状态无法完成考核");
  }

  const newStatus = dto.passed
    ? TrainingStatus.PASSED
    : TrainingStatus.FAILED;

  db.prepare(
    `
    UPDATE trainings 
    SET status = ?, practical_score = ?, theory_score = ?, notes = COALESCE(?, notes), updated_at = datetime('now')
    WHERE id = ?
  `,
  ).run(
    newStatus,
    dto.practicalScore ?? null,
    dto.theoryScore ?? null,
    dto.notes ?? null,
    id,
  );

  if (dto.passed && existing.certificationId) {
    updateCertificationStatus(
      existing.certificationId,
      CertificationStatus.PENDING,
    );
  }

  return getTraining(id);
}

export function listTrainings(
  serviceType?: ServiceType,
  type?: TrainingType,
  status?: TrainingStatus,
  workerId?: number,
  page: number = 1,
  pageSize: number = 20,
): { trainings: Training[]; total: number } {
  const db = getDb();
  let query = "SELECT * FROM trainings";
  let countQuery = "SELECT COUNT(*) as count FROM trainings";
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (serviceType) {
    whereClauses.push("service_type = ?");
    params.push(serviceType);
  }
  if (type) {
    whereClauses.push("type = ?");
    params.push(type);
  }
  if (status) {
    whereClauses.push("status = ?");
    params.push(status);
  }
  if (workerId) {
    whereClauses.push("worker_id = ?");
    params.push(workerId);
  }

  if (whereClauses.length > 0) {
    const whereSql = " WHERE " + whereClauses.join(" AND ");
    query += whereSql;
    countQuery += whereSql;
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, (page - 1) * pageSize);

  const trainings = db
    .prepare(query)
    .all(...params)
    .map(rowToTraining);
  const totalRow = db
    .prepare(countQuery)
    .get(...params.slice(0, params.length - 2)) as any;

  return { trainings, total: totalRow.count };
}

export function getTrainingStatsByServiceType(): Record<string, {
  scheduled: number;
  inProgress: number;
  passed: number;
  failed: number;
}> {
  const db = getDb();

  const rows = db
    .prepare(
      `
    SELECT service_type, status, COUNT(*) as count 
    FROM trainings 
    GROUP BY service_type, status
  `,
    )
    .all() as any[];

  const result: Record<string, {
    scheduled: number;
    inProgress: number;
    passed: number;
    failed: number;
  }> = {};

  for (const row of rows) {
    if (!result[row.service_type]) {
      result[row.service_type] = {
        scheduled: 0,
        inProgress: 0,
        passed: 0,
        failed: 0,
      };
    }
    if (row.status === TrainingStatus.SCHEDULED) {
      result[row.service_type].scheduled = row.count;
    } else if (row.status === TrainingStatus.IN_PROGRESS) {
      result[row.service_type].inProgress = row.count;
    } else if (row.status === TrainingStatus.PASSED) {
      result[row.service_type].passed = row.count;
    } else if (row.status === TrainingStatus.FAILED) {
      result[row.service_type].failed = row.count;
    }
  }

  return result;
}
