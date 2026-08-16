import type { FeedDay, FeedItem, FeedItemType } from '../types/feed.js';
import { MAX_FEED_ITEMS } from '../types/feed.js';
import { TIME_ZONE } from '../types/common.js';
import type { Codec, DocumentDataLike } from '../firestore/converter.js';
import {
  makeConverter,
  optional,
  toDate,
  toDateOrNull,
  toEnum,
  toMap,
  toNumber,
  toStringOrNull,
  toStringValue,
} from '../firestore/converter.js';
import * as f from '../firestore/fields.js';

const ITEM_TYPES: readonly FeedItemType[] = ['offer', 'job', 'business'];

function encodeItem(item: FeedItem): DocumentDataLike {
  return {
    id: item.id,
    type: item.type,
    refId: item.refId,
    businessId: item.businessId,
    rank: item.rank,
    title: { ...item.title },
    subtitle: { ...item.subtitle },
    imageUrl: item.imageUrl,
    href: item.href,
    endsAt: item.endsAt,
  };
}

function decodeItem(value: unknown): FeedItem {
  const map = toMap(value);
  return {
    id: toStringValue(map['id']),
    type: toEnum<FeedItemType>(map['type'], ITEM_TYPES, 'business'),
    refId: toStringValue(map['refId']),
    businessId: toStringValue(map['businessId']),
    rank: toNumber(map['rank']),
    title: f.localizedText(map['title']),
    subtitle: f.localizedText(map['subtitle']),
    imageUrl: toStringOrNull(map['imageUrl']),
    href: toStringValue(map['href'], '/'),
    endsAt: toDateOrNull(map['endsAt']),
  };
}

export const feedDayCodec: Codec<FeedDay> = {
  encode(model): DocumentDataLike {
    return {
      date: model.date,
      timeZone: model.timeZone,
      generatedAt: model.generatedAt,
      // Truncating here rather than at the call site means no writer can
      // accidentally publish an oversized feed document.
      items: optional(model.items, (items) =>
        items.slice(0, MAX_FEED_ITEMS).map(encodeItem),
      ),
      heroItemId: model.heroItemId,
      pushSentAt: model.pushSentAt,
    };
  },

  decode(id, data): FeedDay {
    const items = Array.isArray(data['items']) ? data['items'].map(decodeItem) : [];
    return {
      id,
      date: toStringValue(data['date'], id),
      timeZone: toStringValue(data['timeZone'], TIME_ZONE),
      generatedAt: toDate(data['generatedAt']),
      items,
      heroItemId: toStringOrNull(data['heroItemId']),
      pushSentAt: toDateOrNull(data['pushSentAt']),
    };
  },
};

export const feedDayConverter = makeConverter(feedDayCodec);
