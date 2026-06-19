export enum WorkerStatus {
  PENDING_REVIEW = "pending_review",
  ACTIVE = "active",
  CERTIFIED = "certified",
  FROZEN = "frozen",
}

export enum ServiceType {
  DAILY_CLEANING = "daily_cleaning",
  ELDERLY_CARE = "elderly_care",
  MATERNAL_INFANT_CARE = "maternal_infant_care",
}

export enum SkillLevel {
  JUNIOR = "junior",
  INTERMEDIATE = "intermediate",
  SENIOR = "senior",
}

export enum CertificationStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

export interface Worker {
  id: number;
  idCard: string;
  name: string;
  phone: string;
  avatar?: string;
  serviceTypes: string;
  healthStatus: string;
  yearsOfExperience: number;
  status: WorkerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Certification {
  id: number;
  workerId: number;
  serviceType: ServiceType;
  level: SkillLevel;
  trainingCertificate: string;
  practicalAssessmentRecord: string;
  status: CertificationStatus;
  issuedAt?: string;
  expiresAt?: string;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceTypeConfig {
  id: number;
  type: ServiceType;
  name: string;
  requiredLevel: SkillLevel;
  description: string;
}
