import { initDatabase, getDb } from "../database/database";
import {
  createWorker,
  approveWorker,
  freezeWorker,
  updateWorkerStatus,
} from "../services/workerService";
import {
  applyCertification,
  reviewCertification,
  renewCertification,
  getWorkerCertifications,
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

  const db = getDb();

  try {
    const multiCertWorker = createWorker({
      idCard: "310101198001010001",
      name: "周高级",
      phone: "13800000101",
      serviceTypes: [
        ServiceType.MATERNAL_INFANT_CARE,
        ServiceType.DAILY_CLEANING,
        ServiceType.ELDERLY_CARE,
      ],
      healthStatus: "健康，持有健康证",
      yearsOfExperience: 20,
    });
    approveWorker(multiCertWorker.id);

    const cert1 = applyCertification({
      workerId: multiCertWorker.id,
      serviceType: ServiceType.MATERNAL_INFANT_CARE,
      level: SkillLevel.SENIOR,
      trainingCertificate: "周高级-母婴照料-高级培训结业证书.pdf",
      practicalAssessmentRecord: "周高级-母婴照料-高级实操考核记录.docx",
    });
    reviewCertification(cert1.id, { passed: true, validYears: 3 });

    const cert2 = applyCertification({
      workerId: multiCertWorker.id,
      serviceType: ServiceType.DAILY_CLEANING,
      level: SkillLevel.JUNIOR,
      trainingCertificate: "周高级-日常保洁-初级培训结业证书.pdf",
      practicalAssessmentRecord: "周高级-日常保洁-初级实操考核记录.docx",
    });
    reviewCertification(cert2.id, { passed: true, validYears: 3 });

    const cert3 = applyCertification({
      workerId: multiCertWorker.id,
      serviceType: ServiceType.ELDERLY_CARE,
      level: SkillLevel.INTERMEDIATE,
      trainingCertificate: "周高级-养老陪护-中级培训结业证书.pdf",
      practicalAssessmentRecord: "周高级-养老陪护-中级实操考核记录.docx",
    });
    reviewCertification(cert3.id, { passed: true, validYears: 3 });

    console.log(
      `创建多证书示例: 周高级 (ID: ${multiCertWorker.id}) - 持有母婴高级、保洁初级、养老中级证书`,
    );
  } catch (e) {
    console.log(`跳过已存在的多证书示例人员`);
  }

  try {
    const expiredCertWorker = createWorker({
      idCard: "310101197505050002",
      name: "吴过期",
      phone: "13800000102",
      serviceTypes: [ServiceType.DAILY_CLEANING, ServiceType.ELDERLY_CARE],
      healthStatus: "健康",
      yearsOfExperience: 18,
    });
    approveWorker(expiredCertWorker.id);

    const validCert = applyCertification({
      workerId: expiredCertWorker.id,
      serviceType: ServiceType.DAILY_CLEANING,
      level: SkillLevel.SENIOR,
      trainingCertificate: "吴过期-日常保洁-高级培训结业证书.pdf",
      practicalAssessmentRecord: "吴过期-日常保洁-高级实操考核记录.docx",
    });
    reviewCertification(validCert.id, { passed: true, validYears: 3 });

    const expiredCert = applyCertification({
      workerId: expiredCertWorker.id,
      serviceType: ServiceType.ELDERLY_CARE,
      level: SkillLevel.JUNIOR,
      trainingCertificate: "吴过期-养老陪护-初级培训结业证书.pdf",
      practicalAssessmentRecord: "吴过期-养老陪护-初级实操考核记录.docx",
    });
    reviewCertification(expiredCert.id, { passed: true, validYears: 3 });

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 2);
    const expiredDate = new Date();
    expiredDate.setFullYear(expiredDate.getFullYear() - 1);

    db.prepare(
      `
      UPDATE certifications 
      SET issued_at = ?, expires_at = ?, status = 'expired', updated_at = datetime('now')
      WHERE id = ?
      `,
    ).run(pastDate.toISOString(), expiredDate.toISOString(), expiredCert.id);

    console.log(
      `创建过期证示例: 吴过期 (ID: ${expiredCertWorker.id}) - 保洁高级有效、养老初级已过期`,
    );
  } catch (e) {
    console.log(`跳过已存在的过期证示例人员`);
  }

  try {
    const renewalWorker = createWorker({
      idCard: "310101197808080003",
      name: "郑复审",
      phone: "13800000103",
      serviceTypes: [ServiceType.ELDERLY_CARE],
      healthStatus: "健康，持有护理证",
      yearsOfExperience: 25,
    });
    approveWorker(renewalWorker.id);

    const cert = applyCertification({
      workerId: renewalWorker.id,
      serviceType: ServiceType.ELDERLY_CARE,
      level: SkillLevel.SENIOR,
      trainingCertificate: "郑复审-养老陪护-高级培训结业证书.pdf",
      practicalAssessmentRecord: "郑复审-养老陪护-高级实操考核记录.docx",
    });
    reviewCertification(cert.id, { passed: true, validYears: 1 });
    renewCertification(cert.id, 3);
    renewCertification(cert.id, 3);

    console.log(
      `创建复审示例: 郑复审 (ID: ${renewalWorker.id}) - 养老高级，复审2次`,
    );
  } catch (e) {
    console.log(`跳过已存在的复审示例人员`);
  }

  try {
    const mixedWorker = createWorker({
      idCard: "310101198203030004",
      name: "孙混合",
      phone: "13800000104",
      serviceTypes: [
        ServiceType.MATERNAL_INFANT_CARE,
        ServiceType.DAILY_CLEANING,
        ServiceType.ELDERLY_CARE,
      ],
      healthStatus: "健康",
      yearsOfExperience: 15,
    });
    approveWorker(mixedWorker.id);

    const seniorCert = applyCertification({
      workerId: mixedWorker.id,
      serviceType: ServiceType.MATERNAL_INFANT_CARE,
      level: SkillLevel.SENIOR,
      trainingCertificate: "孙混合-母婴照料-高级培训结业证书.pdf",
      practicalAssessmentRecord: "孙混合-母婴照料-高级实操考核记录.docx",
    });
    reviewCertification(seniorCert.id, { passed: true, validYears: 3 });

    const juniorCert = applyCertification({
      workerId: mixedWorker.id,
      serviceType: ServiceType.DAILY_CLEANING,
      level: SkillLevel.JUNIOR,
      trainingCertificate: "孙混合-日常保洁-初级培训结业证书.pdf",
      practicalAssessmentRecord: "孙混合-日常保洁-初级实操考核记录.docx",
    });
    reviewCertification(juniorCert.id, { passed: true, validYears: 3 });

    const expiredSeniorCert = applyCertification({
      workerId: mixedWorker.id,
      serviceType: ServiceType.ELDERLY_CARE,
      level: SkillLevel.SENIOR,
      trainingCertificate: "孙混合-养老陪护-高级培训结业证书.pdf",
      practicalAssessmentRecord: "孙混合-养老陪护-高级实操考核记录.docx",
    });
    reviewCertification(expiredSeniorCert.id, { passed: true, validYears: 3 });

    const pastDate = new Date();
    pastDate.setFullYear(pastDate.getFullYear() - 4);
    const expiredDate = new Date();
    expiredDate.setFullYear(expiredDate.getFullYear() - 1);

    db.prepare(
      `
      UPDATE certifications 
      SET issued_at = ?, expires_at = ?, status = 'expired', updated_at = datetime('now')
      WHERE id = ?
      `,
    ).run(
      pastDate.toISOString(),
      expiredDate.toISOString(),
      expiredSeniorCert.id,
    );

    console.log(
      `创建混合示例: 孙混合 (ID: ${mixedWorker.id}) - 母婴高级有效、保洁初级有效、养老高级已过期`,
    );
  } catch (e) {
    console.log(`跳过已存在的混合示例人员`);
  }

  console.log("示例数据初始化完成");
}

if (require.main === module) {
  initDatabase();
  seedSampleData();
}
