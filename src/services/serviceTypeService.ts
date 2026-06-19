import { getDb } from "../database/database";
import { ServiceType, SkillLevel, ServiceTypeConfig } from "../models/types";
import { getValidCertification } from "./certificationService";

const levelOrder: Record<SkillLevel, number> = {
  [SkillLevel.JUNIOR]: 1,
  [SkillLevel.INTERMEDIATE]: 2,
  [SkillLevel.SENIOR]: 3,
};

function rowToServiceTypeConfig(row: any): ServiceTypeConfig {
  return {
    id: row.id,
    type: row.type as ServiceType,
    name: row.name,
    requiredLevel: row.required_level as SkillLevel,
    description: row.description,
  };
}

export function initServiceTypeConfigs() {
  const db = getDb();

  const configs = [
    {
      type: ServiceType.DAILY_CLEANING,
      name: "日常保洁",
      requiredLevel: SkillLevel.JUNIOR,
      description: "家庭日常清洁打扫服务",
    },
    {
      type: ServiceType.ELDERLY_CARE,
      name: "养老陪护",
      requiredLevel: SkillLevel.INTERMEDIATE,
      description: "老年人生活照料与陪护服务",
    },
    {
      type: ServiceType.MATERNAL_INFANT_CARE,
      name: "母婴照料",
      requiredLevel: SkillLevel.SENIOR,
      description: "产妇与新生儿专业护理服务",
    },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO service_type_configs (type, name, required_level, description)
    VALUES (?, ?, ?, ?)
  `);

  type SeedConfig = {
    type: ServiceType;
    name: string;
    requiredLevel: SkillLevel;
    description: string;
  };
  const insertMany = db.transaction((items: SeedConfig[]) => {
    for (const config of items) {
      stmt.run(
        config.type,
        config.name,
        config.requiredLevel,
        config.description,
      );
    }
  });

  insertMany(configs);
}

export function getServiceTypeConfig(
  type: ServiceType,
): ServiceTypeConfig | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM service_type_configs WHERE type = ?")
    .get(type);
  return row ? rowToServiceTypeConfig(row) : null;
}

export function listServiceTypeConfigs(): ServiceTypeConfig[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM service_type_configs").all();
  return rows.map(rowToServiceTypeConfig);
}

export function updateServiceTypeRequiredLevel(
  type: ServiceType,
  requiredLevel: SkillLevel,
): ServiceTypeConfig | null {
  const db = getDb();
  const existing = getServiceTypeConfig(type);
  if (!existing) return null;

  db.prepare(
    `
    UPDATE service_type_configs 
    SET required_level = ?, description = description
    WHERE type = ?
  `,
  ).run(requiredLevel, type);

  return getServiceTypeConfig(type);
}

export function canTakeOrder(
  workerId: number,
  serviceType: ServiceType,
): { allowed: boolean; reason?: string } {
  const config = getServiceTypeConfig(serviceType);
  if (!config) {
    return { allowed: false, reason: "服务类型不存在" };
  }

  const cert = getValidCertification(workerId, serviceType);
  if (!cert) {
    return { allowed: false, reason: `未获得${config.name}的有效认证证书` };
  }

  if (levelOrder[cert.level] < levelOrder[config.requiredLevel]) {
    return {
      allowed: false,
      reason: `该服务需要${config.requiredLevel}等级认证，您当前为${cert.level}等级`,
    };
  }

  return { allowed: true };
}

export function compareLevels(a: SkillLevel, b: SkillLevel): number {
  return levelOrder[a] - levelOrder[b];
}
