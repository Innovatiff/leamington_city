import type { Clickout, ClickoutSource, ClickoutTargetType } from '../types/clickout.js';
import { CLICKOUT_SOURCES } from '../types/clickout.js';
import type { Locale } from '../types/common.js';
import { DEFAULT_LOCALE, LOCALES } from '../types/common.js';
import type { Codec, DocumentDataLike } from '../firestore/converter.js';
import {
  makeConverter,
  toDate,
  toEnum,
  toStringOrNull,
  toStringValue,
} from '../firestore/converter.js';

const TARGET_TYPES: readonly ClickoutTargetType[] = ['business', 'offer', 'job'];

export const clickoutCodec: Codec<Clickout> = {
  encode(model): DocumentDataLike {
    return {
      businessId: model.businessId,
      targetType: model.targetType,
      targetId: model.targetId,
      destinationUrl: model.destinationUrl,
      uid: model.uid,
      sessionId: model.sessionId,
      locale: model.locale,
      source: model.source,
      userAgent: model.userAgent,
      referrer: model.referrer,
      createdAt: model.createdAt,
    };
  },

  decode(id, data): Clickout {
    return {
      id,
      businessId: toStringValue(data['businessId']),
      targetType: toEnum<ClickoutTargetType>(data['targetType'], TARGET_TYPES, 'business'),
      targetId: toStringValue(data['targetId']),
      destinationUrl: toStringValue(data['destinationUrl']),
      uid: toStringOrNull(data['uid']),
      sessionId: toStringValue(data['sessionId']),
      locale: toEnum<Locale>(data['locale'], LOCALES, DEFAULT_LOCALE),
      source: toEnum<ClickoutSource>(data['source'], CLICKOUT_SOURCES, 'detail'),
      userAgent: toStringOrNull(data['userAgent']),
      referrer: toStringOrNull(data['referrer']),
      createdAt: toDate(data['createdAt']),
    };
  },
};

export const clickoutConverter = makeConverter(clickoutCodec);
