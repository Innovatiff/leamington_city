import type { Offer, OfferChannel, OfferKind } from '../types/offer.js';
import { OFFER_KINDS } from '../types/offer.js';
import type { PublishStatus } from '../types/common.js';
import type { Codec, DocumentDataLike } from '../firestore/converter.js';
import {
  makeConverter,
  optional,
  optionalCopy,
  toBoolean,
  toDate,
  toEnum,
  toNumber,
  toNumberArray,
  toNumberOrNull,
  toStringOrNull,
  toStringValue,
} from '../firestore/converter.js';
import * as f from '../firestore/fields.js';

const STATUSES: readonly PublishStatus[] = ['draft', 'published', 'expired', 'archived'];
const CHANNELS: readonly OfferChannel[] = ['in_store', 'online', 'both'];

export const offerCodec: Codec<Offer> = {
  encode(model): DocumentDataLike {
    return {
      businessId: model.businessId,
      business: optional(model.business, f.encodeBusinessRef),
      title: optionalCopy(model.title),
      description: optionalCopy(model.description),
      terms: optionalCopy(model.terms),
      kind: model.kind,
      percentOff: model.percentOff,
      amountOff: optionalCopy(model.amountOff),
      channel: model.channel,
      code: model.code,
      imageUrl: model.imageUrl,
      startsAt: model.startsAt,
      endsAt: model.endsAt,
      daysOfWeek: model.daysOfWeek,
      status: model.status,
      redemptionLimit: model.redemptionLimit,
      redemptionCount: model.redemptionCount,
      perUserLimit: model.perUserLimit,
      featured: model.featured,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },

  decode(id, data): Offer {
    return {
      id,
      businessId: toStringValue(data['businessId']),
      business: f.businessRef(data['business']),
      title: f.localizedText(data['title']),
      description: f.localizedText(data['description']),
      terms: f.localizedText(data['terms']),
      kind: toEnum<OfferKind>(data['kind'], OFFER_KINDS, 'other'),
      percentOff: toNumberOrNull(data['percentOff']),
      amountOff: f.money(data['amountOff']),
      channel: toEnum<OfferChannel>(data['channel'], CHANNELS, 'in_store'),
      code: toStringOrNull(data['code']),
      imageUrl: toStringOrNull(data['imageUrl']),
      startsAt: toDate(data['startsAt']),
      endsAt: toDate(data['endsAt']),
      daysOfWeek: toNumberArray(data['daysOfWeek']),
      status: toEnum<PublishStatus>(data['status'], STATUSES, 'draft'),
      redemptionLimit: toNumberOrNull(data['redemptionLimit']),
      redemptionCount: toNumber(data['redemptionCount']),
      perUserLimit: toNumber(data['perUserLimit'], 1),
      featured: toBoolean(data['featured']),
      createdAt: toDate(data['createdAt']),
      updatedAt: toDate(data['updatedAt']),
    };
  },
};

export const offerConverter = makeConverter(offerCodec);
