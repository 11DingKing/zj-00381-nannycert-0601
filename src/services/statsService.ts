import { getDb } from "../database/database";
import { ServiceType, SkillLevel, CertificationStatus } from "../models/types";

export interface LevelDistribution {
  level: SkillLevel;
  count: number;
}

export interface ServiceTypeStats {
  serviceType: ServiceType;
  serviceName: string;
  certifiedCount: number;
  totalApplications: number;
  passRate: number;
  levelDistribution: LevelDistribution[];
}

export interface OverallStats {
  totalWorkers: number;
  pendingReviewCount: number;
  activeCount: number;
  certifiedCount: number;
  frozenCount: number;
  serviceTypeStats: ServiceTypeStats[];
}

export function getOverallStats(): OverallStats {
  const db = getDb();

  const workersByStatus = db
    .prepare(
      `
    SELECT status, COUNT(*) as count 
    FROM workers 
    GROUP BY status
  `,
    )
    .all() as any[];

  const statusCounts: Record<string, number> = {};
  for (const row of workersByStatus) {
    statusCounts[row.status] = row.count;
  }

  const totalWorkers = Object.values(statusCounts).reduce(
    (sum, count) => sum + count,
    0,
  );

  const serviceTypeStats = getServiceTypeStats();

  return {
    totalWorkers,
    pendingReviewCount: statusCounts["pending_review"] || 0,
    activeCount: statusCounts["active"] || 0,
    certifiedCount: statusCounts["certified"] || 0,
    frozenCount: statusCounts["frozen"] || 0,
    serviceTypeStats,
  };
}

export function getServiceTypeStats(): ServiceTypeStats[] {
  const db = getDb();

  const serviceTypes = db
    .prepare("SELECT * FROM service_type_configs")
    .all() as any[];
  const result: ServiceTypeStats[] = [];

  for (const st of serviceTypes) {
    const serviceType = st.type as ServiceType;

    const certifiedCount = db
      .prepare(
        `
      SELECT COUNT(DISTINCT worker_id) as count 
      FROM certifications 
      WHERE service_type = ? 
        AND status = 'approved' 
        AND expires_at > datetime('now')
    `,
      )
      .get(serviceType) as any;

    const totalApproved = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM certifications 
      WHERE service_type = ? AND status = 'approved'
    `,
      )
      .get(serviceType) as any;

    const totalRejected = db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM certifications 
      WHERE service_type = ? AND status = 'rejected'
    `,
      )
      .get(serviceType) as any;

    const totalApplications = totalApproved.count + totalRejected.count;
    const passRate =
      totalApplications > 0
        ? (totalApproved.count / totalApplications) * 100
        : 0;

    const levelDistribution = getLevelDistributionByServiceType(serviceType);

    result.push({
      serviceType,
      serviceName: st.name,
      certifiedCount: certifiedCount.count,
      totalApplications,
      passRate: Math.round(passRate * 100) / 100,
      levelDistribution,
    });
  }

  return result;
}

export function getLevelDistributionByServiceType(
  serviceType: ServiceType,
): LevelDistribution[] {
  const db = getDb();

  const rows = db
    .prepare(
      `
    SELECT level, COUNT(DISTINCT worker_id) as count 
    FROM certifications 
    WHERE service_type = ? 
      AND status = 'approved' 
      AND expires_at > datetime('now')
    GROUP BY level
    ORDER BY 
      CASE level 
        WHEN 'junior' THEN 1 
        WHEN 'intermediate' THEN 2 
        WHEN 'senior' THEN 3 
      END
  `,
    )
    .all(serviceType) as any[];

  const allLevels: SkillLevel[] = [
    SkillLevel.JUNIOR,
    SkillLevel.INTERMEDIATE,
    SkillLevel.SENIOR,
  ];
  const result: LevelDistribution[] = [];

  for (const level of allLevels) {
    const row = rows.find((r) => r.level === level);
    result.push({
      level,
      count: row ? row.count : 0,
    });
  }

  return result;
}

export function getCertificationStatsByStatus(): Record<
  CertificationStatus,
  number
> {
  const db = getDb();

  const rows = db
    .prepare(
      `
    SELECT status, COUNT(*) as count 
    FROM certifications 
    GROUP BY status
  `,
    )
    .all() as any[];

  const result: Record<string, number> = {};
  for (const status of Object.values(CertificationStatus)) {
    result[status] = 0;
  }

  for (const row of rows) {
    result[row.status] = row.count;
  }

  return result as Record<CertificationStatus, number>;
}
