import type { Redemption, RedemptionState } from '../types/redemption.js';
import { REDEMPTION_STATES } from '../types/redemption.js';
import type { Locale } from '../types/common.js';
import { DEFAULT_LOCALE, LOCALES } from '../types/common.js';
import type { Codec, DocumentDataLike } from '../firestore/converter.js';
import {
  makeConverter,
  toDate,
  toDateOrNull,
  toEnum,
  toStringOrNull,
  toStringValue,
} from '../firestore/converter.js';

export const redemptionCodec: Codec<Redemption> = {
  encode(model): DocumentDataLike {
    return {
      offerId: model.offerId,
      businessId: model.businessId,
      uid: model.uid,
      code: model.code,
      state: model.state,
      issuedAt: model.issuedAt,
      expiresAt: model.expiresAt,
      redeemedAt: model.redeemedAt,
      redeemedBy: model.redeemedBy,
      locale: model.locale,
    };
  },

  decode(id, data): Redemption {
    return {
      id,
      offerId: toStringValue(data['offerId']),
      businessId: toStringValue(data['businessId']),
      uid: toStringValue(data['uid']),
      code: toStringValue(data['code']),
      state: toEnum<RedemptionState>(data['state'], REDEMPTION_STATES, 'issued'),
      issuedAt: toDate(data['issuedAt']),
      expiresAt: toDate(data['expiresAt']),
      redeemedAt: toDateOrNull(data['redeemedAt']),
      redeemedBy: toStringOrNull(data['redeemedBy']),
      locale: toEnum<Locale>(data['locale'], LOCALES, DEFAULT_LOCALE),
    };
  },
};

export const redemptionConverter = makeConverter(redemptionCodec);
