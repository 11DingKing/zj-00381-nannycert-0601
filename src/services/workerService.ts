import { getDb } from "../database/database";
import { WorkerStatus, Worker, ServiceType } from "../models/types";

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
