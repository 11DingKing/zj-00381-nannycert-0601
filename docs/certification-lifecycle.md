# 家政员证书与接单资格全链路说明

> 本文档用于帮助接手开发的同学快速理解：家政员从建档到报名评定、授证、复审、过期失效、再到能否接单的完整逻辑链路。
> 所有判断均以现有代码实现为准，不做需求猜测。

---

## 一、核心数据模型

### 1.1 家政员（Worker）

数据定义：[types.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/models/types.ts#L79-L91)

**状态枚举 `WorkerStatus`**：

| 状态 | 说明 |
|------|------|
| `pending_review` | 待审核，刚建档的初始状态 |
| `active` | 活跃，审核通过但尚无有效证书 |
| `certified` | 持证，至少有一张有效证书 |
| `frozen` | 冻结，无法申请认证、无法接单 |

**状态流转规则**（硬编码在 `updateWorkerStatus` 中）：
- `pending_review` → `active` / `frozen`
- `active` → `certified` / `frozen`
- `certified` → `active` / `frozen`
- `frozen` → `active`

代码位置：[workerService.ts#L183-L192](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/workerService.ts#L183-L192)

### 1.2 证书（Certification）

数据定义：[types.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/models/types.ts#L93-L106)

**状态枚举 `CertificationStatus`**：

| 状态 | 说明 |
|------|------|
| `pending` | 待审核，刚提交申请 |
| `approved` | 已通过，证书有效 |
| `rejected` | 已拒绝，审核未通过 |
| `expired` | 已过期，超过有效期 |
| `remedial_training` | 补训中，复审未通过需补训 |
| `revoked` | 已撤销，被吊销 |

**等级枚举 `SkillLevel`**：`junior`（初级） < `intermediate`（中级） < `senior`（高级）

**关键字段**：
- `level`：证书等级
- `issued_at`：发证时间
- `expires_at`：过期时间
- `review_count`：复审次数

### 1.3 培训（Training）

数据定义：[types.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/models/types.ts#L43-L61)

**类型枚举 `TrainingType`**：
- `initial`：初始培训
- `refresher`：复训
- `remedial`：补训

**状态枚举 `TrainingStatus`**：
- `scheduled`：已排期
- `in_progress`：进行中
- `completed`：已完成
- `passed`：考核通过
- `failed`：考核未通过

### 1.4 服务类型配置（ServiceTypeConfig）

数据定义：[types.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/models/types.ts#L108-L114)

每种服务类型对应一个**接单所需最低等级**，初始化在 `initServiceTypeConfigs` 中：

| 服务类型 | 名称 | 最低等级 |
|----------|------|----------|
| `daily_cleaning` | 日常保洁 | `junior`（初级） |
| `elderly_care` | 养老陪护 | `intermediate`（中级） |
| `maternal_infant_care` | 母婴照料 | `senior`（高级） |

代码位置：[serviceTypeService.ts#L26-L73](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/serviceTypeService.ts#L26-L73)

---

## 二、完整生命周期链路

### 阶段 1：建档与审核

**入口函数**：`createWorker` — [workerService.ts#L55-L85](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/workerService.ts#L55-L85)

```
建档（createWorker）
    ↓
初始状态：pending_review
    ↓
审核通过（approveWorker）
    ↓
状态变为：active
```

**注意**：
- 建档时 `serviceTypes` 字段存储 JSON 数组，表示该人员登记了哪些服务类型
- 申请证书时，必须是已登记的服务类型，否则报错

### 阶段 2：报名评定（申请证书）

**入口函数**：`applyCertification` — [certificationService.ts#L58-L110](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/certificationService.ts#L58-L110)

**申请前置条件**（缺一不可）：
1. 家政员存在
2. 家政员状态不是 `frozen`
3. 家政员状态不是 `pending_review`
4. 申请的服务类型在该人员的 `serviceTypes` 中
5. 同一服务类型同一等级没有 `pending` 状态的申请

**申请提交后**：
- 证书状态：`pending`
- 需提交材料：`trainingCertificate`（培训结业证书）、`practicalAssessmentRecord`（实操考核记录）

### 阶段 3：审核授证

**入口函数**：`reviewCertification` — [certificationService.ts#L244-L286](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/certificationService.ts#L244-L286)

**审核通过**：
- 证书状态 → `approved`
- 设置 `issued_at` = 当前时间
- 设置 `expires_at` = 当前时间 + `validYears`（默认 3 年）
- **如果人员状态是 `active`，自动升级为 `certified`**

**审核不通过**：
- 证书状态 → `rejected`

### 阶段 4：持证接单

**接单资格判断函数**：`canTakeOrder` — [serviceTypeService.ts#L110-L149](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/serviceTypeService.ts#L110-L149)

**判断顺序**（任一不满足即不可接单）：

```
1. 服务类型配置存在？
    ↓ 否 → "服务类型不存在"
2. 家政员存在？
    ↓ 否 → "家政人员不存在"
3. 人员状态不是 frozen？
    ↓ 否 → "人员已被冻结，禁止接单"
4. 人员状态不是 pending_review？
    ↓ 否 → "人员待审核中，暂不可接单"
5. 有该服务类型的有效证书？
    ↓ 否 → "未获得XX的有效认证证书"
6. 证书等级 >= 服务类型要求的最低等级？
    ↓ 否 → "该服务需要X等级认证，您当前为Y等级"
    ↓ 是 → 可以接单
```

**"有效证书"的定义**（`getValidCertification`）：
- 状态为 `approved`
- `expires_at > 当前时间`
- 同一服务类型有多张证书时，取**等级最高**的那张

代码位置：[certificationService.ts#L128-L155](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/certificationService.ts#L128-L155)

**更详细的资格说明**（`getServiceTypeEligibility`）：

除了上面的判断，还会区分以下不可接单原因：
- 补训中，暂停接单
- 证书已过期，暂停接单
- 认证未通过
- 认证审核中
- 证书已被撤销，禁止接单
- 未取得该服务类型认证

代码位置：[workerService.ts#L219-L340](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/workerService.ts#L219-L340)

### 阶段 5：复审与补训

#### 5.1 正常复审

**入口函数**：`renewCertification` — [certificationService.ts#L288-L326](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/certificationService.ts#L288-L326)

**复审前置条件**：
- 证书状态是 `approved` **或** `expired`

**复审通过后**：
- 证书状态 → `approved`
- `issued_at` 更新为当前时间
- `expires_at` = 当前时间 + `validYears`（默认 3 年）
- `review_count += 1`
- 如果人员状态是 `active`，自动升级为 `certified`

#### 5.2 补训流程

当复审未通过或其他原因需要补训时，走补训流程：

```
创建补训（createTraining, type=remedial）
    ↓ 自动触发
证书状态 → remedial_training
    ↓
开始培训（startTraining）
    ↓
培训状态：scheduled → in_progress
    ↓
完成考核（completeTraining）
    ├─ 通过 → 培训状态 passed，证书状态 → pending（等待复审）
    └─ 不通过 → 培训状态 failed
    ↓
复审评定（reviewRenewalCertification）
    ├─ 通过 → 证书状态 approved，review_count += 1，重新计算有效期
    └─ 不通过 → 证书状态 rejected
```

**关键代码**：
- 创建补训：[trainingService.ts#L66-L112](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/trainingService.ts#L66-L112)
- 完成考核：[trainingService.ts#L218-L259](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/trainingService.ts#L218-L259)
- 复审评定：[certificationService.ts#L480-L527](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/certificationService.ts#L480-L527)

**注意**：
- 补训培训通过后，证书状态从 `remedial_training` 变回 `pending`
- 然后用 `reviewRenewalCertification` 进行复审
- `reviewRenewalCertification` 接受 `pending` 或 `remedial_training` 状态的证书

### 阶段 6：过期失效

**自动过期函数**：`expireCertifications` — [certificationService.ts#L328-L343](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/certificationService.ts#L328-L343)

**过期条件**：
- 证书状态为 `approved`
- `expires_at <= 当前时间`

**过期后**：
- 证书状态 → `expired`
- 该服务类型的接单资格丧失

**即将到期查询**：`getExpiringCertifications` — 查询未来 N 天内（默认 30 天）到期的证书

代码位置：[certificationService.ts#L411-L439](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/certificationService.ts#L411-L439)

---

## 三、等级、有效期、复审记录的相互影响

### 3.1 等级（level）的作用

1. **决定接单门槛**：证书等级必须 >= 服务类型要求的最低等级
   - 日常保洁：初级及以上
   - 养老陪护：中级及以上
   - 母婴照料（高端单）：高级及以上

2. **同服务类型取最高等级**：当一个人有同一服务类型的多张有效证书时，取等级最高的那张用于接单判断
   - 代码：`getValidCertification` 中的 `ORDER BY CASE level ... LIMIT 1`

3. **等级分布统计**：统计每个服务类型各等级的持证人数
   - 代码：`getLevelDistributionByServiceType`

### 3.2 有效期（expires_at）的作用

1. **决定证书是否有效**：`expires_at > now` 才算有效
2. **过期自动失效**：`expireCertifications` 批量标记过期
3. **复审刷新有效期**：复审通过后，从当前时间重新计算有效期
4. **快到期预警**：`getExpiringCertifications` 查询即将到期的证书

### 3.3 复审记录（review_count）的作用

1. **记录复审次数**：每次复审通过 `review_count += 1`
2. **标识复审记录**：`review_count > 0` 的证书即为有复审历史
   - 在 `getWorkerCertificationProfile` 中，`reviewRecords` 就是筛选 `reviewCount > 0` 的证书

### 3.4 三者的联动关系

```
证书申请 → 审核通过 → 等级确定 + 有效期开始 + review_count=0
    ↓
临近过期 → 申请复审
    ↓
复审通过 → 等级不变 + 有效期刷新 + review_count+1
    ↓
复审未通过 → 可能进入补训
    ↓
补训通过 → 再次复审
    ↓
复审通过 → 等级不变 + 有效期刷新 + review_count+1
    ↓
过期未复审 → 证书状态 expired → 无法接单
```

**关键点**：
- 复审不改变证书等级，只刷新有效期
- 过期的证书仍可以通过复审恢复有效
- `review_count` 只增不减，是累计值

---

## 四、持证统计相关

### 4.1 总体统计（OverallStats）

**函数**：`getOverallStats` — [statsService.ts#L56-L89](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/statsService.ts#L56-L89)

包含：
- 总家政员数
- 各状态人员数（待审核、活跃、持证、冻结）
- 各服务类型统计（持证人数、申请总数、通过率、等级分布）

### 4.2 运营统计（OperationsStats）

**函数**：`getOperationsStats` — [statsService.ts#L245-L395](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/statsService.ts#L245-L395)

按服务类型统计：
- `eligibleCount`：可接单人数（有有效证书且非冻结）
- `expiringSoonCount`：即将到期人数（默认 30 天内）
- `expiredCount`：已过期人数
- `remedialTrainingCount`：补训中人数
- `pendingReviewCount`：待审核人数
- `rejectedCount`：被拒人数
- `revokedCount`：被撤销人数

### 4.3 等级分布统计

**函数**：`getLevelDistributionByServiceType` — [statsService.ts#L157-L215](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/statsService.ts#L157-L215)

**注意**：统计时用了 `ROW_NUMBER() OVER (PARTITION BY worker_id ORDER BY level DESC)`，即**每个人只按其最高等级的证书统计一次**，不会重复计数。

---

## 五、关键代码索引

| 功能模块 | 主要文件 | 核心函数 |
|----------|----------|----------|
| 家政员管理 | [workerService.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/workerService.ts) | `createWorker`, `approveWorker`, `getWorkerProfile`, `getServiceTypeEligibility` |
| 证书管理 | [certificationService.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/certificationService.ts) | `applyCertification`, `reviewCertification`, `renewCertification`, `expireCertifications`, `getValidCertification` |
| 培训管理 | [trainingService.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/trainingService.ts) | `createTraining`, `startTraining`, `completeTraining` |
| 服务类型/接单 | [serviceTypeService.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/serviceTypeService.ts) | `canTakeOrder`, `initServiceTypeConfigs` |
| 统计 | [statsService.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/services/statsService.ts) | `getOverallStats`, `getOperationsStats`, `getLevelDistributionByServiceType` |
| 数据类型 | [types.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/models/types.ts) | 所有枚举和接口定义 |
| 数据库 | [database.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/database/database.ts) | 表结构定义 |
| 示例数据 | [seed.ts](file:///Users/ding/Documents/SOLOCODE%203/0618/macmini/zj-00381-nannycert-5/src/data/seed.ts) | 种子数据，包含各种场景的示例 |

---

## 六、常见场景速查

### Q: 家政员什么时候能接母婴照料（高端单）？
A: 同时满足以下条件：
1. 人员状态不是 `frozen`、不是 `pending_review`
2. 有 `maternal_infant_care` 服务类型的有效证书（状态 `approved` 且未过期）
3. 证书等级是 `senior`（高级）

### Q: 证书过期了怎么办？
A: 可以直接调用 `renewCertification` 进行复审，复审通过后证书恢复有效，有效期从复审通过日重新计算。

### Q: 补训期间能接单吗？
A: 不能。补训时证书状态是 `remedial_training`，不属于有效证书，`getValidCertification` 查不到，因此 `canTakeOrder` 会返回 false。

### Q: 一个人能有多个服务类型的证书吗？
A: 可以。每个服务类型可以有独立的证书和等级，互不影响。接单判断是按服务类型分别判断的。

### Q: `active` 和 `certified` 状态有什么区别？
A: 
- `active`：审核通过，但没有任何有效证书
- `certified`：至少有一张有效证书
- 获得首张有效证书时自动从 `active` 升级为 `certified`
- 注意：目前代码中没有"所有证书都过期后从 certified 降回 active"的逻辑

### Q: `reviewCertification` 和 `reviewRenewalCertification` 有什么区别？
A:
- `reviewCertification`：用于首次申请的审核，只接受 `pending` 状态，通过后 `review_count` 不变（还是 0）
- `reviewRenewalCertification`：用于复审，接受 `pending` 或 `remedial_training` 状态，通过后 `review_count += 1`
