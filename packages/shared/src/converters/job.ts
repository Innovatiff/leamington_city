import type {
  Compensation,
  CompensationPeriod,
  EmploymentType,
  Job,
  Workplace,
} from '../types/job.js';
import { EMPLOYMENT_TYPES } from '../types/job.js';
import type { CurrencyCode, PublishStatus } from '../types/common.js';
import { DEFAULT_CURRENCY } from '../types/common.js';
import type { Codec, DocumentDataLike } from '../firestore/converter.js';
import {
  makeConverter,
  optional,
  optionalCopy,
  toDate,
  toEnum,
  toMap,
  toNumber,
  toStringOrNull,
  toStringValue,
} from '../firestore/converter.js';
import * as f from '../firestore/fields.js';

const STATUSES: readonly PublishStatus[] = ['draft', 'published', 'expired', 'archived'];
const WORKPLACES: readonly Workplace[] = ['onsite', 'hybrid', 'remote'];
const PERIODS: readonly CompensationPeriod[] = ['hour', 'day', 'week', 'month', 'year'];

function compensation(value: unknown): Compensation | null {
  if (value === null || value === undefined) return null;
  const map = toMap(value);
  if (typeof map['min'] !== 'number' && typeof map['max'] !== 'number') return null;
  const min = toNumber(map['min']);
  return {
    min,
    max: toNumber(map['max'], min),
    currency: toEnum<CurrencyCode>(map['currency'], ['CAD', 'USD'], DEFAULT_CURRENCY),
    period: toEnum<CompensationPeriod>(map['period'], PERIODS, 'hour'),
  };
}

export const jobCodec: Codec<Job> = {
  encode(model): DocumentDataLike {
    return {
      businessId: model.businessId,
      business: optional(model.business, f.encodeBusinessRef),
      title: optionalCopy(model.title),
      description: optionalCopy(model.description),
      employmentType: model.employmentType,
      workplace: model.workplace,
      compensation: optionalCopy(model.compensation),
      applyUrl: model.applyUrl,
      applyEmail: model.applyEmail,
      postedAt: model.postedAt,
      expiresAt: model.expiresAt,
      status: model.status,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },

  decode(id, data): Job {
    return {
      id,
      businessId: toStringValue(data['businessId']),
      business: f.businessRef(data['business']),
      title: f.localizedText(data['title']),
      description: f.localizedText(data['description']),
      employmentType: toEnum<EmploymentType>(
        data['employmentType'],
        EMPLOYMENT_TYPES,
        'part_time',
      ),
      workplace: toEnum<Workplace>(data['workplace'], WORKPLACES, 'onsite'),
      compensation: compensation(data['compensation']),
      applyUrl: toStringOrNull(data['applyUrl']),
      applyEmail: toStringOrNull(data['applyEmail']),
      postedAt: toDate(data['postedAt']),
      expiresAt: toDate(data['expiresAt']),
      status: toEnum<PublishStatus>(data['status'], STATUSES, 'draft'),
      createdAt: toDate(data['createdAt']),
      updatedAt: toDate(data['updatedAt']),
    };
  },
};

export const jobConverter = makeConverter(jobCodec);
