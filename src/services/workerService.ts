import { getDb } from "../database/database";
import {
  WorkerStatus,
  Worker,
  ServiceType,
  Certification,
  Training,
  ServiceTypeEligibility,
  WorkerProfile,
  CertificationStatus,
  TrainingStatus,
} from "../models/types";
import {
  getWorkerCertifications,
  getValidCertification,
} from "./certificationService";
import { getWorkerTrainings, getActiveTraining } from "./trainingService";
import { getServiceTypeConfig } from "./serviceTypeService";

export interface CreateWorkerDto {
  idCard: string;
  name: string;
  phone: string;
  avatar?: string;
  serviceTypes: ServiceType[];
  healthStatus: string;
  yearsOfExperience: number;
}

export interface UpdateWorkerDto {
  name?: string;
  phone?: string;
  avatar?: string;
  serviceTypes?: ServiceType[];
  healthStatus?: string;
  yearsOfExperience?: number;
}

function rowToWorker(row: any): Worker {
  return {
    id: row.id,
    idCard: row.id_card,
    name: row.name,
    phone: row.phone,
    avatar: row.avatar,
    serviceTypes: row.service_types,
    healthStatus: row.health_status,
    yearsOfExperience: row.years_of_experience,
    status: row.status as WorkerStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorker(dto: CreateWorkerDto): Worker {
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM workers WHERE id_card = ?")
    .get(dto.idCard);
  if (existing) {
    throw new Error("该身份证号已注册");
  }

  const stmt = db.prepare(`
    INSERT INTO workers (id_card, name, phone, avatar, service_types, health_status, years_of_experience, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    dto.idCard,
    dto.name,
    dto.phone,
    dto.avatar || null,
    JSON.stringify(dto.serviceTypes),
    dto.healthStatus,
    dto.yearsOfExperience,
    WorkerStatus.PENDING_REVIEW,
  );

  const worker = db
    .prepare("SELECT * FROM workers WHERE id = ?")
    .get(result.lastInsertRowid);
  return rowToWorker(worker);
}

export function getWorker(id: number): Worker | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM workers WHERE id = ?").get(id);
  return row ? rowToWorker(row) : null;
}

export function getWorkerByIdCard(idCard: string): Worker | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM workers WHERE id_card = ?").get(idCard);
  return row ? rowToWorker(row) : null;
}

export function listWorkers(
  status?: WorkerStatus,
  page: number = 1,
  pageSize: number = 20,
): { workers: Worker[]; total: number } {
  const db = getDb();
  let query = "SELECT * FROM workers";
  let countQuery = "SELECT COUNT(*) as count FROM workers";
  const params: any[] = [];

  if (status) {
    query += " WHERE status = ?";
    countQuery += " WHERE status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, (page - 1) * pageSize);

  const workers = db
    .prepare(query)
    .all(...params)
    .map(rowToWorker);
  const totalRow = db
    .prepare(countQuery)
    .get(...params.slice(0, status ? 1 : 0)) as any;

  return { workers, total: totalRow.count };
}

export function updateWorker(id: number, dto: UpdateWorkerDto): Worker | null {
  const db = getDb();
  const existing = getWorker(id);
  if (!existing) return null;

  const fields: string[] = [];
  const values: any[] = [];

  if (dto.name !== undefined) {
    fields.push("name = ?");
    values.push(dto.name);
  }
  if (dto.phone !== undefined) {
    fields.push("phone = ?");
    values.push(dto.phone);
  }
  if (dto.avatar !== undefined) {
    fields.push("avatar = ?");
    values.push(dto.avatar);
  }
  if (dto.serviceTypes !== undefined) {
    fields.push("service_types = ?");
    values.push(JSON.stringify(dto.serviceTypes));
  }
  if (dto.healthStatus !== undefined) {
    fields.push("health_status = ?");
    values.push(dto.healthStatus);
  }
  if (dto.yearsOfExperience !== undefined) {
    fields.push("years_of_experience = ?");
    values.push(dto.yearsOfExperience);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(
    `UPDATE workers SET ${fields.join(", ")} WHERE id = ?`,
  );
  stmt.run(...values);

  return getWorker(id);
}

export function updateWorkerStatus(
  id: number,
  status: WorkerStatus,
): Worker | null {
  const db = getDb();
  const existing = getWorker(id);
  if (!existing) return null;

  const validTransitions: Record<WorkerStatus, WorkerStatus[]> = {
    [WorkerStatus.PENDING_REVIEW]: [WorkerStatus.ACTIVE, WorkerStatus.FROZEN],
    [WorkerStatus.ACTIVE]: [WorkerStatus.CERTIFIED, WorkerStatus.FROZEN],
    [WorkerStatus.CERTIFIED]: [WorkerStatus.ACTIVE, WorkerStatus.FROZEN],
    [WorkerStatus.FROZEN]: [WorkerStatus.ACTIVE],
  };

  if (!validTransitions[existing.status].includes(status)) {
    throw new Error(`无法从 ${existing.status} 状态变更为 ${status}`);
  }

  db.prepare(
    "UPDATE workers SET status = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(status, id);

  return getWorker(id);
}

export function approveWorker(id: number): Worker | null {
  return updateWorkerStatus(id, WorkerStatus.ACTIVE);
}

export function freezeWorker(id: number): Worker | null {
  return updateWorkerStatus(id, WorkerStatus.FROZEN);
}

export function unfreezeWorker(id: number): Worker | null {
  return updateWorkerStatus(id, WorkerStatus.ACTIVE);
}

export function deleteWorker(id: number): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM workers WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getServiceTypeEligibility(
  workerId: number,
  serviceType: ServiceType,
): ServiceTypeEligibility {
  const config = getServiceTypeConfig(serviceType);
  const serviceName = config?.name || serviceType;

  const cert = getValidCertification(workerId, serviceType);
  const activeTraining = getActiveTraining(workerId, serviceType);

  if (cert) {
    return {
      serviceType,
      serviceName,
      eligible: true,
      reason: "证书有效，可正常接单",
      certification: cert,
      activeTraining: activeTraining ?? undefined,
    };
  }

  const allCerts = getWorkerCertifications(workerId);
  const serviceCerts = allCerts.filter((c) => c.serviceType === serviceType);

  if (activeTraining) {
    return {
      serviceType,
      serviceName,
      eligible: false,
      reason: "补训中，暂停接单",
      certification: serviceCerts[0],
      activeTraining,
    };
  }

  const latestCert = serviceCerts[0];
  if (latestCert) {
    if (latestCert.status === CertificationStatus.EXPIRED) {
      return {
        serviceType,
        serviceName,
        eligible: false,
        reason: "证书已过期，暂停接单",
        certification: latestCert,
      };
    }
    if (latestCert.status === CertificationStatus.REJECTED) {
      return {
        serviceType,
        serviceName,
        eligible: false,
        reason: "认证未通过",
        certification: latestCert,
      };
    }
    if (latestCert.status === CertificationStatus.PENDING) {
      return {
        serviceType,
        serviceName,
        eligible: false,
        reason: "认证审核中",
        certification: latestCert,
      };
    }
    if (latestCert.status === CertificationStatus.REMEDIAL_TRAINING) {
      return {
        serviceType,
        serviceName,
        eligible: false,
        reason: "补训中，暂停接单",
        certification: latestCert,
      };
    }
  }

  return {
    serviceType,
    serviceName,
    eligible: false,
    reason: "未取得该服务类型认证",
  };
}

export function getWorkerProfile(workerId: number): WorkerProfile | null {
  const worker = getWorker(workerId);
  if (!worker) return null;

  const certifications = getWorkerCertifications(workerId);
  const trainings = getWorkerTrainings(workerId);

  const serviceTypes = JSON.parse(worker.serviceTypes) as ServiceType[];
  const eligibility: ServiceTypeEligibility[] = serviceTypes.map((st) =>
    getServiceTypeEligibility(workerId, st),
  );

  return {
    worker,
    certifications,
    trainings,
    eligibility,
  };
}

export function getWorkersByEligibility(
  serviceType: ServiceType,
  eligible: boolean,
  page: number = 1,
  pageSize: number = 20,
): {
  workers: Array<{ worker: Worker; eligibility: ServiceTypeEligibility }>;
  total: number;
} {
  const db = getDb();
  const now = new Date().toISOString();

  if (eligible) {
    const query = `
      SELECT w.*, c.id as cert_id
      FROM workers w
      JOIN certifications c ON w.id = c.worker_id
      WHERE c.service_type = ?
        AND c.status = 'approved'
        AND c.expires_at > ?
        AND w.status != 'frozen'
      GROUP BY w.id
      ORDER BY c.expires_at ASC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT w.id) as count
      FROM workers w
      JOIN certifications c ON w.id = c.worker_id
      WHERE c.service_type = ?
        AND c.status = 'approved'
        AND c.expires_at > ?
        AND w.status != 'frozen'
    `;

    const rows = db
      .prepare(query)
      .all(serviceType, now, pageSize, (page - 1) * pageSize);
    const totalRow = db.prepare(countQuery).get(serviceType, now) as any;

    const workers = rows.map((row: any) => {
      const worker = rowToWorker(row);
      const eligibility = getServiceTypeEligibility(worker.id, serviceType);
      return { worker, eligibility };
    });

    return { workers, total: totalRow.count };
  } else {
    const query = `
      SELECT DISTINCT w.*
      FROM workers w
      LEFT JOIN certifications c ON w.id = c.worker_id AND c.service_type = ?
      WHERE (c.id IS NULL 
         OR c.status != 'approved' 
         OR c.expires_at <= ?
         OR w.status = 'frozen')
        AND w.status != 'pending_review'
      ORDER BY w.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT w.id) as count
      FROM workers w
      LEFT JOIN certifications c ON w.id = c.worker_id AND c.service_type = ?
      WHERE (c.id IS NULL 
         OR c.status != 'approved' 
         OR c.expires_at <= ?
         OR w.status = 'frozen')
        AND w.status != 'pending_review'
    `;

    const rows = db
      .prepare(query)
      .all(serviceType, now, pageSize, (page - 1) * pageSize);
    const totalRow = db.prepare(countQuery).get(serviceType, now) as any;

    const workers = rows.map((row: any) => {
      const worker = rowToWorker(row);
      const eligibility = getServiceTypeEligibility(worker.id, serviceType);
      return { worker, eligibility };
    });

    return { workers, total: totalRow.count };
  }
}

export function getWorkersInRemedialTraining(
  serviceType?: ServiceType,
  page: number = 1,
  pageSize: number = 20,
): {
  workers: Array<{
    worker: Worker;
    training: Training;
    certification?: Certification;
  }>;
  total: number;
} {
  const db = getDb();

  let query = `
    SELECT w.*, t.id as training_id
    FROM workers w
    JOIN trainings t ON w.id = t.worker_id
    WHERE t.type = 'remedial'
      AND t.status IN ('scheduled', 'in_progress')
  `;

  let countQuery = `
    SELECT COUNT(DISTINCT w.id) as count
    FROM workers w
    JOIN trainings t ON w.id = t.worker_id
    WHERE t.type = 'remedial'
      AND t.status IN ('scheduled', 'in_progress')
  `;

  const params: any[] = [];
  const countParams: any[] = [];

  if (serviceType) {
    query += " AND t.service_type = ?";
    countQuery += " AND t.service_type = ?";
    params.push(serviceType);
    countParams.push(serviceType);
  }

  query += " GROUP BY w.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?";
  params.push(pageSize, (page - 1) * pageSize);

  const rows = db.prepare(query).all(...params);
  const totalRow = db.prepare(countQuery).get(...countParams) as any;

  const workers = rows.map((row: any) => {
    const worker = rowToWorker(row);
    const trainings = getWorkerTrainings(worker.id).filter(
      (t) =>
        t.type === "remedial" &&
        (t.status === TrainingStatus.SCHEDULED ||
          t.status === TrainingStatus.IN_PROGRESS) &&
        (!serviceType || t.serviceType === serviceType),
    );
    const training = trainings[0];
    const certification = training?.certificationId
      ? getWorkerCertifications(worker.id).find(
          (c) => c.id === training.certificationId,
        )
      : undefined;
    return { worker, training, certification };
  });

  return { workers, total: totalRow.count };
}
