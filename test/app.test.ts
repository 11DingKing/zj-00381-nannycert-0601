import { initDatabase, closeDatabase } from "../src/database/database";
import * as workerService from "../src/services/workerService";
import * as certificationService from "../src/services/certificationService";
import * as serviceTypeService from "../src/services/serviceTypeService";
import * as statsService from "../src/services/statsService";
import {
  WorkerStatus,
  ServiceType,
  SkillLevel,
  CertificationStatus,
} from "../src/models/types";

let db: any;

beforeAll(() => {
  db = initDatabase(":memory:");
  serviceTypeService.initServiceTypeConfigs();
});

afterAll(() => {
  closeDatabase();
});

describe("家政人员管理", () => {
  test("注册新家政人员", () => {
    const worker = workerService.createWorker({
      idCard: "110101199001011234",
      name: "张三",
      phone: "13900000001",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 3,
    });

    expect(worker).toBeDefined();
    expect(worker.id).toBeGreaterThan(0);
    expect(worker.name).toBe("张三");
    expect(worker.status).toBe(WorkerStatus.PENDING_REVIEW);
  });

  test("同身份证号不能重复注册", () => {
    expect(() => {
      workerService.createWorker({
        idCard: "110101199001011234",
        name: "张三2",
        phone: "13900000002",
        serviceTypes: [ServiceType.DAILY_CLEANING],
        healthStatus: "健康",
        yearsOfExperience: 5,
      });
    }).toThrow("该身份证号已注册");
  });

  test("审核通过家政人员", () => {
    const worker = workerService.createWorker({
      idCard: "110101199002022345",
      name: "李四",
      phone: "13900000003",
      serviceTypes: [ServiceType.ELDERLY_CARE],
      healthStatus: "健康",
      yearsOfExperience: 2,
    });

    const approved = workerService.approveWorker(worker.id);
    expect(approved).toBeDefined();
    expect(approved!.status).toBe(WorkerStatus.ACTIVE);
  });

  test("冻结家政人员", () => {
    const worker = workerService.createWorker({
      idCard: "110101199003033456",
      name: "王五",
      phone: "13900000004",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 1,
    });

    workerService.approveWorker(worker.id);
    const frozen = workerService.freezeWorker(worker.id);
    expect(frozen!.status).toBe(WorkerStatus.FROZEN);
  });

  test("解冻家政人员", () => {
    const worker = workerService.createWorker({
      idCard: "110101199004044567",
      name: "赵六",
      phone: "13900000005",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 4,
    });

    workerService.approveWorker(worker.id);
    workerService.freezeWorker(worker.id);
    const unfrozen = workerService.unfreezeWorker(worker.id);
    expect(unfrozen!.status).toBe(WorkerStatus.ACTIVE);
  });

  test("获取家政人员列表", () => {
    const result = workerService.listWorkers();
    expect(result.workers.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  test("按状态筛选家政人员", () => {
    const result = workerService.listWorkers(WorkerStatus.PENDING_REVIEW);
    for (const w of result.workers) {
      expect(w.status).toBe(WorkerStatus.PENDING_REVIEW);
    }
  });
});

describe("技能认证管理", () => {
  test("申请技能认证", () => {
    const worker = workerService.createWorker({
      idCard: "110101199005055678",
      name: "钱七",
      phone: "13900000006",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 3,
    });
    workerService.approveWorker(worker.id);

    const cert = certificationService.applyCertification({
      workerId: worker.id,
      serviceType: ServiceType.DAILY_CLEANING,
      level: SkillLevel.JUNIOR,
      trainingCertificate: "培训结业证.pdf",
      practicalAssessmentRecord: "实操考核记录.docx",
    });

    expect(cert).toBeDefined();
    expect(cert.status).toBe(CertificationStatus.PENDING);
    expect(cert.serviceType).toBe(ServiceType.DAILY_CLEANING);
    expect(cert.level).toBe(SkillLevel.JUNIOR);
  });

  test("评审通过认证", () => {
    const worker = workerService.createWorker({
      idCard: "110101199006066789",
      name: "孙八",
      phone: "13900000007",
      serviceTypes: [ServiceType.ELDERLY_CARE],
      healthStatus: "健康",
      yearsOfExperience: 5,
    });
    workerService.approveWorker(worker.id);

    const cert = certificationService.applyCertification({
      workerId: worker.id,
      serviceType: ServiceType.ELDERLY_CARE,
      level: SkillLevel.INTERMEDIATE,
      trainingCertificate: "培训结业证.pdf",
      practicalAssessmentRecord: "实操考核记录.docx",
    });

    const reviewed = certificationService.reviewCertification(cert.id, {
      passed: true,
      validYears: 2,
    });
    expect(reviewed!.status).toBe(CertificationStatus.APPROVED);
    expect(reviewed!.issuedAt).toBeDefined();
    expect(reviewed!.expiresAt).toBeDefined();

    const updatedWorker = workerService.getWorker(worker.id);
    expect(updatedWorker!.status).toBe(WorkerStatus.CERTIFIED);
  });

  test("评审拒绝认证", () => {
    const worker = workerService.createWorker({
      idCard: "110101199007077890",
      name: "周九",
      phone: "13900000008",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 1,
    });
    workerService.approveWorker(worker.id);

    const cert = certificationService.applyCertification({
      workerId: worker.id,
      serviceType: ServiceType.DAILY_CLEANING,
      level: SkillLevel.JUNIOR,
      trainingCertificate: "培训结业证.pdf",
      practicalAssessmentRecord: "实操考核记录.docx",
    });

    const reviewed = certificationService.reviewCertification(cert.id, {
      passed: false,
    });
    expect(reviewed!.status).toBe(CertificationStatus.REJECTED);
  });

  test("复审续期认证", () => {
    const worker = workerService.createWorker({
      idCard: "110101199008088901",
      name: "吴十",
      phone: "13900000009",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 6,
    });
    workerService.approveWorker(worker.id);

    const cert = certificationService.applyCertification({
      workerId: worker.id,
      serviceType: ServiceType.DAILY_CLEANING,
      level: SkillLevel.JUNIOR,
      trainingCertificate: "培训结业证.pdf",
      practicalAssessmentRecord: "实操考核记录.docx",
    });

    certificationService.reviewCertification(cert.id, {
      passed: true,
      validYears: 1,
    });

    const renewed = certificationService.renewCertification(cert.id, 3);
    expect(renewed!.status).toBe(CertificationStatus.APPROVED);
    expect(renewed!.reviewCount).toBe(1);
  });

  test("待审核人员不能申请认证", () => {
    const worker = workerService.createWorker({
      idCard: "110101199009099012",
      name: "郑十一",
      phone: "13900000010",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 2,
    });

    expect(() => {
      certificationService.applyCertification({
        workerId: worker.id,
        serviceType: ServiceType.DAILY_CLEANING,
        level: SkillLevel.JUNIOR,
        trainingCertificate: "培训结业证.pdf",
        practicalAssessmentRecord: "实操考核记录.docx",
      });
    }).toThrow("该人员尚未审核通过");
  });

  test("未登记的服务类型不能申请认证", () => {
    const worker = workerService.createWorker({
      idCard: "110101199010100123",
      name: "王十二",
      phone: "13900000011",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 2,
    });
    workerService.approveWorker(worker.id);

    expect(() => {
      certificationService.applyCertification({
        workerId: worker.id,
        serviceType: ServiceType.MATERNAL_INFANT_CARE,
        level: SkillLevel.JUNIOR,
        trainingCertificate: "培训结业证.pdf",
        practicalAssessmentRecord: "实操考核记录.docx",
      });
    }).toThrow("该人员未登记此服务类型");
  });
});

describe("服务类型与接单校验", () => {
  test("服务类型配置初始化", () => {
    const configs = serviceTypeService.listServiceTypeConfigs();
    expect(configs.length).toBe(3);

    const cleaning = configs.find((c) => c.type === ServiceType.DAILY_CLEANING);
    expect(cleaning!.requiredLevel).toBe(SkillLevel.JUNIOR);

    const elderly = configs.find((c) => c.type === ServiceType.ELDERLY_CARE);
    expect(elderly!.requiredLevel).toBe(SkillLevel.INTERMEDIATE);

    const maternal = configs.find(
      (c) => c.type === ServiceType.MATERNAL_INFANT_CARE,
    );
    expect(maternal!.requiredLevel).toBe(SkillLevel.SENIOR);
  });

  test("无认证不能接高级单", () => {
    const worker = workerService.createWorker({
      idCard: "110101199011111234",
      name: "李十三",
      phone: "13900000012",
      serviceTypes: [ServiceType.MATERNAL_INFANT_CARE],
      healthStatus: "健康",
      yearsOfExperience: 1,
    });
    workerService.approveWorker(worker.id);

    const result = serviceTypeService.canTakeOrder(
      worker.id,
      ServiceType.MATERNAL_INFANT_CARE,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("未获得");
  });

  test("等级不够不能接单", () => {
    const worker = workerService.createWorker({
      idCard: "110101199012122345",
      name: "张十四",
      phone: "13900000013",
      serviceTypes: [ServiceType.ELDERLY_CARE],
      healthStatus: "健康",
      yearsOfExperience: 1,
    });
    workerService.approveWorker(worker.id);

    const cert = certificationService.applyCertification({
      workerId: worker.id,
      serviceType: ServiceType.ELDERLY_CARE,
      level: SkillLevel.JUNIOR,
      trainingCertificate: "培训结业证.pdf",
      practicalAssessmentRecord: "实操考核记录.docx",
    });
    certificationService.reviewCertification(cert.id, { passed: true });

    const result = serviceTypeService.canTakeOrder(
      worker.id,
      ServiceType.ELDERLY_CARE,
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("需要");
  });

  test("等级达标可以接单", () => {
    const worker = workerService.createWorker({
      idCard: "110101199101013456",
      name: "刘十五",
      phone: "13900000014",
      serviceTypes: [ServiceType.DAILY_CLEANING],
      healthStatus: "健康",
      yearsOfExperience: 3,
    });
    workerService.approveWorker(worker.id);

    const cert = certificationService.applyCertification({
      workerId: worker.id,
      serviceType: ServiceType.DAILY_CLEANING,
      level: SkillLevel.JUNIOR,
      trainingCertificate: "培训结业证.pdf",
      practicalAssessmentRecord: "实操考核记录.docx",
    });
    certificationService.reviewCertification(cert.id, { passed: true });

    const result = serviceTypeService.canTakeOrder(
      worker.id,
      ServiceType.DAILY_CLEANING,
    );
    expect(result.allowed).toBe(true);
  });
});

describe("统计功能", () => {
  beforeAll(() => {
    for (let i = 0; i < 3; i++) {
      const worker = workerService.createWorker({
        idCard: `1101011992010${i}0000`,
        name: `测试人员${i}`,
        phone: `1390000100${i}`,
        serviceTypes: [ServiceType.DAILY_CLEANING, ServiceType.ELDERLY_CARE],
        healthStatus: "健康",
        yearsOfExperience: i + 1,
      });
      workerService.approveWorker(worker.id);

      const cert = certificationService.applyCertification({
        workerId: worker.id,
        serviceType: ServiceType.DAILY_CLEANING,
        level:
          i === 0
            ? SkillLevel.JUNIOR
            : i === 1
              ? SkillLevel.INTERMEDIATE
              : SkillLevel.SENIOR,
        trainingCertificate: "培训结业证.pdf",
        practicalAssessmentRecord: "实操考核记录.docx",
      });
      certificationService.reviewCertification(cert.id, { passed: true });
    }
  });

  test("整体统计数据完整", () => {
    const stats = statsService.getOverallStats();
    expect(stats.totalWorkers).toBeGreaterThan(0);
    expect(stats.serviceTypeStats.length).toBe(3);
  });

  test("按服务类型统计", () => {
    const stats = statsService.getServiceTypeStats();
    const cleaningStat = stats.find(
      (s) => s.serviceType === ServiceType.DAILY_CLEANING,
    );
    expect(cleaningStat).toBeDefined();
    expect(cleaningStat!.certifiedCount).toBeGreaterThan(0);
    expect(cleaningStat!.levelDistribution.length).toBe(3);
  });

  test("等级分布统计", () => {
    const distribution = statsService.getLevelDistributionByServiceType(
      ServiceType.DAILY_CLEANING,
    );
    expect(distribution.length).toBe(3);
    expect(distribution[0].level).toBe(SkillLevel.JUNIOR);
    expect(distribution[1].level).toBe(SkillLevel.INTERMEDIATE);
    expect(distribution[2].level).toBe(SkillLevel.SENIOR);
  });

  test("认证状态统计", () => {
    const statusStats = statsService.getCertificationStatsByStatus();
    expect(statusStats[CertificationStatus.APPROVED]).toBeGreaterThan(0);
    expect(statusStats[CertificationStatus.PENDING]).toBeGreaterThanOrEqual(0);
  });
});
