/**
 * Converter plumbing.
 *
 * `packages/shared` deliberately depends on neither `firebase` nor
 * `firebase-admin`: the two SDKs ship incompatible `Timestamp` and
 * `DocumentSnapshot` classes, and importing either one here would drag a
 * runtime into the Astro build. Instead we describe the *shape* both SDKs
 * satisfy and convert structurally.
 *
 * On the way out we hand Firestore native `Date` objects, which both SDKs
 * serialise to `Timestamp`. On the way in we accept `Timestamp`, `Date`, an
 * ISO string, or epoch millis, because emulator exports and REST payloads all
 * differ.
 */

export interface DocumentDataLike {
  [key: string]: unknown;
}

/** Both SDKs' `QueryDocumentSnapshot` satisfy this. */
export interface SnapshotLike {
  readonly id: string;
  data(): DocumentDataLike | undefined;
}

/**
 * Structural stand-in for `FirestoreDataConverter` from either SDK. `toFirestore`
 * takes `any` so it stays assignable to the SDKs' `WithFieldValue<T>` /
 * `PartialWithFieldValue<T>` overloads.
 */
export interface DataConverterLike<T> {
  toFirestore(model: any): DocumentDataLike;
  fromFirestore(snapshot: any, options?: unknown): T;
}

/** Encode/decode pair for one collection. */
export interface Codec<T extends { id: string }> {
  encode(model: Omit<T, 'id'>): DocumentDataLike;
  decode(id: string, data: DocumentDataLike): T;
}

interface TimestampLike {
  toDate(): Date;
}

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as TimestampLike).toDate === 'function'
  );
}

/**
 * Accepts anything Firestore might hand back for a timestamp field and returns
 * a `Date`, or `null` when the value is absent or unparseable. Decoding never
 * throws: a single malformed document must not fail a static build of the
 * whole directory.
 */
export function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (isTimestampLike(value)) return value.toDate();
  if (typeof value === 'number') {
    const fromMillis = new Date(value);
    return Number.isNaN(fromMillis.getTime()) ? null : fromMillis;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  // Plain `{ seconds, nanoseconds }` — how the REST API and emulator dumps look.
  if (typeof value === 'object') {
    const seconds = (value as { seconds?: unknown; _seconds?: unknown }).seconds ??
      (value as { _seconds?: unknown })._seconds;
    if (typeof seconds === 'number') return new Date(seconds * 1000);
  }
  return null;
}

/** Same as {@link toDateOrNull} but substitutes `fallback` (default: epoch). */
export function toDate(value: unknown, fallback: Date = new Date(0)): Date {
  return toDateOrNull(value) ?? fallback;
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

export function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is number => typeof entry === 'number');
}

/** Narrows to one of `allowed`, falling back when the stored value is unknown. */
export function toEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function toMap(value: unknown): DocumentDataLike {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as DocumentDataLike)
    : {};
}

/**
 * Strips `undefined` recursively. Firestore rejects `undefined` outright, and
 * spread-based partial updates produce it constantly.
 */
export function pruneUndefined<T extends DocumentDataLike>(data: T): T {
  const out: DocumentDataLike = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      out[key] = value;
    } else if (value instanceof Date) {
      out[key] = value;
    } else if (typeof value === 'object' && value !== null && !isTimestampLike(value)) {
      out[key] = pruneUndefined(value as DocumentDataLike);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

/**
 * Maps a value that may be absent, null, or present, preserving the difference
 * between "not in this patch" and "explicitly cleared".
 *
 * Codec `encode` methods use this for every nested object so that a partial
 * model encodes to a partial document: `undefined` survives as `undefined` and
 * is then pruned, while `null` is written as a real null. Writing
 * `model.x ? {...model.x} : null` instead would turn an absent field in a merge
 * patch into a destructive null.
 */
export function optional<V, R>(
  value: V | null | undefined,
  map: (present: V) => R,
): R | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return map(value);
}

/** Shallow copy of a present value, preserving absent/null. */
export function optionalCopy<V extends object>(
  value: V | null | undefined,
): V | null | undefined {
  return optional(value, (present) => ({ ...present }));
}

/**
 * Encodes a partial model for a `set(..., { merge: true })` or `update()` call.
 *
 * Absent fields stay absent, so an unrelated field is never clobbered. Requires
 * the codec's `encode` to be field-by-field and absence-preserving — which is
 * what {@link optional} is for.
 */
export function encodePartial<T extends { id: string }>(
  codec: Codec<T>,
  patch: Partial<Omit<T, 'id'>>,
): DocumentDataLike {
  return pruneUndefined(codec.encode(patch as Omit<T, 'id'>));
}

/** Lifts a {@link Codec} into something both SDKs accept as a converter. */
export function makeConverter<T extends { id: string }>(
  codec: Codec<T>,
): DataConverterLike<T> {
  return {
    toFirestore(model: Omit<T, 'id'> & { id?: string }): DocumentDataLike {
      // `id` is synthetic — it lives in the document path, not the document.
      const { id: _ignored, ...rest } = model as { id?: string };
      return pruneUndefined(codec.encode(rest as Omit<T, 'id'>));
    },
    fromFirestore(snapshot: SnapshotLike): T {
      return codec.decode(snapshot.id, snapshot.data() ?? {});
    },
  };
}
