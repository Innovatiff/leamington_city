import type { BusinessRef, CurrencyCode, LocalizedText, PublishStatus } from './common.js';

export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'seasonal',
  'contract',
  'temporary',
] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export type Workplace = 'onsite' | 'hybrid' | 'remote';

export type CompensationPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';

export interface Compensation {
  /** Minor units (cents). */
  min: number;
  max: number;
  currency: CurrencyCode;
  period: CompensationPeriod;
}

export interface Job {
  id: string;
  businessId: string;
  business: BusinessRef;
  title: LocalizedText;
  description: LocalizedText;
  employmentType: EmploymentType;
  workplace: Workplace;
  compensation: Compensation | null;
  applyUrl: string | null;
  applyEmail: string | null;
  postedAt: Date;
  expiresAt: Date;
  status: PublishStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** A job cannot be published without somewhere to send an applicant. */
export function isApplyable(job: Job): boolean {
  return Boolean(job.applyUrl ?? job.applyEmail);
}
