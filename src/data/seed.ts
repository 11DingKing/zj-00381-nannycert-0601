import { initDatabase } from "../database/database";
import {
  createWorker,
  approveWorker,
  freezeWorker,
  updateWorkerStatus,
} from "../services/workerService";
import {
  applyCertification,
  reviewCertification,
} from "../services/certificationService";
import { initServiceTypeConfigs } from "../services/serviceTypeService";
import { ServiceType, SkillLevel, WorkerStatus } from "../models/types";

export function seedSampleData() {
  const workersData = [
    {
      idCard: "310101198501011234",
      name: "王秀兰",
      phone: "13800000001",
      serviceTypes: [ServiceType.DAILY_CLEANING, ServiceType.ELDERLY_CARE],
      healthStatus: "健康",
      yearsOfExperience: 8,
      certifications: [
        {
          serviceType: ServiceType.DAILY_CLEANING,
          level: SkillLevel.INTERMEDIATE,
        },
        { serviceType: ServiceType.ELDERLY_CARE, level: SkillLevel.JUNIOR },
      ],
      status: WorkerStatus.CERTIFIED,
    },
    {
      idCard: "310101199005055678",
      name: "李桂芳",
      phone: "13800000002",
      serviceTypes: [
        ServiceType.MATERNAL_INFANT_CARE,
        ServiceType.DAILY_CLEANING,
      ],
      healthStatus: "健康，持有健康证",
      yearsOfExperience: 12,
      certifications: [
        {
          serviceType: ServiceType.MATERNAL_INFANT_CARE,
          level: SkillLevel.SENIOR,
        },
        { serviceType: ServiceType.DAILY_CLEANING, level: SkillLevel.SENIOR },
      ],
      status: WorkerStatus.CERTIFIED,
    },
    {
      idCard: "310101199503039012",
      name: "张小花",
      phone: "13800000003",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 2,
      certifications: [
        { serviceType: ServiceType.DAILY_CLEANING, level: SkillLevel.JUNIOR },
      ],
      status: WorkerStatus.CERTIFIED,
    },
    {
      idCard: "310101198808083456",
      name: "刘美华",
      phone: "13800000004",
      serviceTypes: [
        ServiceType.ELDERLY_CARE,
        ServiceType.MATERNAL_INFANT_CARE,
      ],
      healthStatus: "健康，持有健康证、护理证",
      yearsOfExperience: 15,
      certifications: [],
      status: WorkerStatus.ACTIVE,
    },
    {
      idCard: "310101199812127890",
      name: "陈晓梅",
      phone: "13800000005",
      serviceTypes: [ServiceType.DAILY_CLEANING, ServiceType.ELDERLY_CARE],
      healthStatus: "健康",
      yearsOfExperience: 1,
      certifications: [],
      status: WorkerStatus.PENDING_REVIEW,
    },
    {
      idCard: "310101198202022345",
      name: "赵金凤",
      phone: "13800000006",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 5,
      certifications: [
        { serviceType: ServiceType.DAILY_CLEANING, level: SkillLevel.JUNIOR },
      ],
      status: WorkerStatus.FROZEN,
    },
  ];

  initServiceTypeConfigs();

  const createdWorkers: {
    id: number;
    targetStatus: WorkerStatus;
    hasCerts: boolean;
  }[] = [];

  for (const workerData of workersData) {
    try {
      const worker = createWorker({
        idCard: workerData.idCard,
        name: workerData.name,
        phone: workerData.phone,
        serviceTypes: workerData.serviceTypes,
        healthStatus: workerData.healthStatus,
        yearsOfExperience: workerData.yearsOfExperience,
      });

      createdWorkers.push({
        id: worker.id,
        targetStatus: workerData.status,
        hasCerts: workerData.certifications.length > 0,
      });

      if (workerData.status !== WorkerStatus.PENDING_REVIEW) {
        approveWorker(worker.id);
      }

      if (workerData.status !== WorkerStatus.PENDING_REVIEW) {
        for (const certData of workerData.certifications) {
          const cert = applyCertification({
            workerId: worker.id,
            serviceType: certData.serviceType,
            level: certData.level,
            trainingCertificate: `${workerData.name}-${certData.serviceType}-培训结业证书.pdf`,
            practicalAssessmentRecord: `${workerData.name}-${certData.serviceType}-实操考核记录.docx`,
          });

          reviewCertification(cert.id, { passed: true, validYears: 3 });
        }
      }
    } catch (e) {
      console.log(`跳过已存在的人员: ${workerData.name}`);
    }
  }

  for (const w of createdWorkers) {
    if (w.targetStatus === WorkerStatus.FROZEN) {
      freezeWorker(w.id);
    }
  }

  console.log("示例数据初始化完成");
}

if (require.main === module) {
  initDatabase();
  seedSampleData();
}
