import type { AppUser, UserRole } from '../types/user.js';
import type { Locale } from '../types/common.js';
import { DEFAULT_LOCALE, LOCALES } from '../types/common.js';
import type { Codec, DocumentDataLike } from '../firestore/converter.js';
import {
  makeConverter,
  optional,
  toBoolean,
  toDate,
  toEnum,
  toMap,
  toStringArray,
  toStringOrNull,
} from '../firestore/converter.js';

const ROLES: readonly UserRole[] = ['admin', 'owner'];

export const appUserCodec: Codec<AppUser> = {
  encode(model): DocumentDataLike {
    return {
      locale: model.locale,
      businessId: model.businessId,
      roles: model.roles,
      push: optional(model.push, (push) => ({
        token: push.token,
        enabled: push.enabled,
        lastSentDay: push.lastSentDay,
      })),
      savedBusinessIds: model.savedBusinessIds,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  },

  decode(id, data): AppUser {
    const push = toMap(data['push']);
    return {
      id,
      locale: toEnum<Locale>(data['locale'], LOCALES, DEFAULT_LOCALE),
      businessId: toStringOrNull(data['businessId']),
      roles: toStringArray(data['roles']).filter((role): role is UserRole =>
        (ROLES as readonly string[]).includes(role),
      ),
      push: {
        token: toStringOrNull(push['token']),
        enabled: toBoolean(push['enabled']),
        lastSentDay: toStringOrNull(push['lastSentDay']),
      },
      savedBusinessIds: toStringArray(data['savedBusinessIds']),
      createdAt: toDate(data['createdAt']),
      updatedAt: toDate(data['updatedAt']),
    };
  },
};

export const appUserConverter = makeConverter(appUserCodec);
