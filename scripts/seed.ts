/**
 * Seeds Firestore with stub-tier business documents from a CSV.
 *
 *   pnpm seed -- --file ./scripts/data/leamington-businesses.sample.csv --dry-run
 *   pnpm seed -- --file ./data/leamington.csv --emulator
 *   pnpm seed -- --file ./data/leamington.csv --commit
 *
 * Behaviour worth knowing before you run it against production:
 *
 *   - Dry run is the default. Nothing is written without `--commit`.
 *   - Slugs are permanent public URLs, so they are generated once and never
 *     regenerated: a row that matches an existing business keeps its slug.
 *   - A business that has been claimed (tier !== 'stub') is never modified.
 *     The seed imports directory data; it does not overwrite an owner's work.
 *   - Re-running is safe. Matching is by (normalised name + postal code), then
 *     by slug, so a second run updates rather than duplicates.
 *
 * Expected columns (case- and separator-insensitive; all but `name` optional):
 *   name, category, address_line1, address_line2, city, province, postal_code,
 *   phone, email, website, short_description_en, short_description_es,
 *   description_en, description_es, facebook, instagram, tags, lat, lng,
 *   hours_mon … hours_sun (e.g. "9:00-17:00", "11:00-14:00;17:00-21:00",
 *   "20:00-02:00" for past midnight, or "closed"),
 *   logo, hero, photos (semicolon-separated; any http(s) URL — Firebase
 *   Storage, a CDN, the business's own site)
 */

import { readFile } from 'node:fs/promises';
import { argv, exit } from 'node:process';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  BUSINESS_CATEGORIES,
  COLLECTIONS,
  TIER_RANK,
  businessCodec,
  businessConverter,
  encodePartial,
  slugify,
  toSortName,
  uniqueSlug,
  type Business,
  type BusinessCategory,
  type HoursInterval,
  type WeekHours,
} from '@leamington/shared';
import { parseCsvRows, pickColumn, type CsvRow } from './csv.ts';

// ---------------------------------------------------------------------- args

interface Options {
  file: string;
  commit: boolean;
  emulator: boolean;
  limit: number;
  projectId: string | undefined;
}

function parseArgs(args: string[]): Options {
  const options: Options = {
    file: '',
    commit: false,
    emulator: false,
    limit: Number.POSITIVE_INFINITY,
    projectId: process.env['GOOGLE_CLOUD_PROJECT'],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = (): string => {
      const value = args[index + 1];
      if (value === undefined) fail(`${arg} needs a value.`);
      index += 1;
      return value as string;
    };

    if (arg === '--file' || arg === '-f') options.file = next();
    else if (arg === '--limit') options.limit = Number(next());
    else if (arg === '--project') options.projectId = next();
    else if (arg === '--commit') options.commit = true;
    else if (arg === '--dry-run') options.commit = false;
    else if (arg === '--emulator') options.emulator = true;
    else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      exit(0);
    } else if (arg !== undefined && arg.startsWith('-')) {
      fail(`Unknown flag ${arg}. Try --help.`);
    }
  }

  if (!options.file) fail('Missing --file. Try --help.');
  return options;
}

const USAGE = `Usage: pnpm seed -- --file <csv> [options]

  --file, -f <path>   CSV to ingest (required)
  --commit            Actually write. Without this it is a dry run.
  --emulator          Target the local Firestore emulator (127.0.0.1:8080)
  --project <id>      Firebase project id (default: GOOGLE_CLOUD_PROJECT / .firebaserc)
  --limit <n>         Only process the first n rows
  --help, -h          Show this message`;

function fail(message: string): never {
  console.error(`error: ${message}`);
  exit(1);
}

// ------------------------------------------------------------------- mapping

/** Free-text category from a municipal export → our controlled vocabulary. */
const CATEGORY_ALIASES: Record<string, BusinessCategory> = {
  restaurant: 'restaurant',
  restaurants: 'restaurant',
  food: 'restaurant',
  dining: 'restaurant',
  takeout: 'restaurant',
  pizzeria: 'restaurant',
  cafe: 'cafe',
  coffee: 'cafe',
  'coffee shop': 'cafe',
  bakery: 'bakery',
  bakeries: 'bakery',
  grocery: 'grocery',
  'grocery store': 'grocery',
  supermarket: 'grocery',
  market: 'grocery',
  retail: 'retail',
  shop: 'retail',
  store: 'retail',
  clothing: 'retail',
  beauty: 'beauty',
  salon: 'beauty',
  barber: 'beauty',
  spa: 'beauty',
  health: 'health',
  clinic: 'health',
  dental: 'health',
  dentist: 'health',
  pharmacy: 'health',
  automotive: 'automotive',
  auto: 'automotive',
  mechanic: 'automotive',
  'auto repair': 'automotive',
  'home services': 'home_services',
  contractor: 'home_services',
  plumbing: 'home_services',
  landscaping: 'home_services',
  professional: 'professional',
  legal: 'professional',
  accounting: 'professional',
  insurance: 'professional',
  'real estate': 'professional',
  agriculture: 'agriculture',
  greenhouse: 'agriculture',
  farm: 'agriculture',
  farming: 'agriculture',
  recreation: 'recreation',
  fitness: 'recreation',
  gym: 'recreation',
  entertainment: 'recreation',
  lodging: 'lodging',
  hotel: 'lodging',
  motel: 'lodging',
  nonprofit: 'nonprofit',
  charity: 'nonprofit',
  church: 'nonprofit',
};

export function toCategory(raw: string): BusinessCategory {
  const key = raw.trim().toLowerCase();
  if (!key) return 'other';
  if ((BUSINESS_CATEGORIES as readonly string[]).includes(key)) {
    return key as BusinessCategory;
  }
  const direct = CATEGORY_ALIASES[key];
  if (direct) return direct;
  // Loose contains match — exports say "Restaurant - Full Service" a lot.
  for (const [alias, category] of Object.entries(CATEGORY_ALIASES)) {
    if (key.includes(alias)) return category;
  }
  return 'other';
}

/**
 * Image URL from a spreadsheet cell.
 *
 * Only http(s) is accepted, so a stray filename or a `javascript:` string never
 * reaches an `<img src>`. A rejected cell simply leaves the field null, and the
 * app falls back to its generated category cover.
 */
export function toImageUrl(raw: string): string | null {
  const url = toUrl(raw);
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

/** Semicolon- or pipe-separated gallery. Capped: this renders on a phone. */
export function toImageList(raw: string, max = 6): string[] {
  return [
    ...new Set(
      raw
        .split(/[;|]/)
        .map((entry) => toImageUrl(entry))
        .filter((entry): entry is string => entry !== null),
    ),
  ].slice(0, max);
}

/** Adds a scheme so a bare `example.com` in a spreadsheet is still a usable link. */
export function toUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

function toE164Ca(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function toEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

function toPostalCode(raw: string): string {
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact)
    ? `${compact.slice(0, 3)} ${compact.slice(3)}`
    : raw.trim().toUpperCase();
}

function toCoordinate(raw: string, min: number, max: number): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value === 0) return null;
  return value >= min && value <= max ? value : null;
}

/**
 * Parses one day's opening hours.
 *
 * Accepts `9:00-17:00`, `09:00 - 17:00`, `9-17`, several ranges separated by
 * `,` or `;`, and the words `closed` / `cerrado` (or an empty cell) for a day
 * with no hours. A range whose end is at or before its start is kept as-is —
 * `20:00-02:00` is a real thing here and `openStateAt` reads it as spanning
 * midnight.
 */
export function parseDayHours(raw: string): HoursInterval[] {
  const value = raw.trim().toLowerCase();
  if (!value || value === 'closed' || value === 'cerrado' || value === '-') return [];

  const intervals: HoursInterval[] = [];
  for (const part of value.split(/[;,]/)) {
    const match = /^\s*(\d{1,2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*$/.exec(part);
    if (!match) continue;

    const open = Number(match[1]) * 60 + Number(match[2] ?? 0);
    const close = Number(match[3]) * 60 + Number(match[4] ?? 0);
    // Reject nonsense rather than storing hours that would render as garbage.
    if (open >= 1440 || close >= 1440) continue;
    intervals.push({ open, close });
  }

  return intervals.sort((a, b) => a.open - b.open);
}

const HOURS_COLUMNS: readonly (readonly string[])[] = [
  ['hours_sun', 'sunday', 'sun'],
  ['hours_mon', 'monday', 'mon'],
  ['hours_tue', 'tuesday', 'tue'],
  ['hours_wed', 'wednesday', 'wed'],
  ['hours_thu', 'thursday', 'thu'],
  ['hours_fri', 'friday', 'fri'],
  ['hours_sat', 'saturday', 'sat'],
];

/** `null` when the export carries no hours at all — distinct from "closed all week". */
function parseWeekHours(row: CsvRow): WeekHours | null {
  const present = HOURS_COLUMNS.some(
    (names) => pickColumn(row, ...names).trim().length > 0,
  );
  if (!present) return null;

  return HOURS_COLUMNS.map((names) =>
    parseDayHours(pickColumn(row, ...names)),
  ) as WeekHours;
}

function toTags(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[;|,]/)
        .map((tag) => slugify(tag))
        .filter((tag) => tag.length > 0),
    ),
  ].slice(0, 12);
}

/**
 * Identity for re-runs. Name alone collides (three "Tim Hortons"), postal code
 * alone collides (a plaza), so it is the pair.
 */
export function dedupeKey(name: string, postalCode: string): string {
  return `${slugify(name)}::${postalCode.replace(/\s+/g, '').toUpperCase()}`;
}

export interface ParsedRow {
  name: string;
  category: BusinessCategory;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  shortEn: string;
  shortEs: string;
  descriptionEn: string;
  descriptionEs: string;
  facebook: string | null;
  instagram: string | null;
  tags: string[];
  logoUrl: string | null;
  heroUrl: string | null;
  photos: string[];
  hours: WeekHours | null;
  lat: number | null;
  lng: number | null;
}

export function parseRow(row: CsvRow): ParsedRow | null {
  const name = pickColumn(row, 'name', 'business_name', 'company', 'legal_name');
  if (!name) return null;

  const shortEn = pickColumn(row, 'short_description_en', 'short_description', 'summary');
  const descriptionEn = pickColumn(row, 'description_en', 'description', 'about');

  return {
    name,
    category: toCategory(pickColumn(row, 'category', 'type', 'industry', 'sector')),
    line1: pickColumn(row, 'address_line1', 'address', 'street_address', 'address_1'),
    line2: pickColumn(row, 'address_line2', 'unit', 'suite', 'address_2') || null,
    city: pickColumn(row, 'city', 'municipality', 'town') || 'Leamington',
    province: pickColumn(row, 'province', 'state') || 'ON',
    postalCode: toPostalCode(pickColumn(row, 'postal_code', 'postalcode', 'zip')),
    phone: toE164Ca(pickColumn(row, 'phone', 'telephone', 'phone_number')),
    email: toEmail(pickColumn(row, 'email', 'email_address')),
    websiteUrl: toUrl(pickColumn(row, 'website', 'website_url', 'url', 'web')),
    shortEn,
    // A missing Spanish string falls back to English. Untranslated is bad;
    // blank is worse, and the translation pass happens after import.
    shortEs: pickColumn(row, 'short_description_es') || shortEn,
    descriptionEn,
    descriptionEs: pickColumn(row, 'description_es') || descriptionEn,
    facebook: toUrl(pickColumn(row, 'facebook', 'facebook_url')),
    instagram: toUrl(pickColumn(row, 'instagram', 'instagram_url')),
    tags: toTags(pickColumn(row, 'tags', 'keywords')),
    logoUrl: toImageUrl(pickColumn(row, 'logo', 'logo_url')),
    heroUrl: toImageUrl(pickColumn(row, 'hero', 'hero_url', 'image', 'photo')),
    photos: toImageList(pickColumn(row, 'photos', 'gallery', 'images')),
    hours: parseWeekHours(row),
    // Leamington sits near 42.05 N, -82.6 W. The bounds reject swapped columns.
    lat: toCoordinate(pickColumn(row, 'lat', 'latitude'), 41, 43),
    lng: toCoordinate(pickColumn(row, 'lng', 'lon', 'longitude'), -84, -81),
  };
}

/** Stub-tier document. Everything an owner would edit is left empty on purpose. */
export function toBusiness(
  parsed: ParsedRow,
  id: string,
  slug: string,
  now: Date,
): Business {
  return {
    id,
    slug,
    tier: 'stub',
    // Imported records are publicly listed — an unclaimed directory is still a
    // directory. `business.unclaimedNote` tells the reader where it came from.
    status: 'published',
    name: parsed.name,
    sortName: toSortName(parsed.name),
    category: parsed.category,
    categories: [parsed.category],
    shortDescription: { en: parsed.shortEn, es: parsed.shortEs },
    description: { en: parsed.descriptionEn, es: parsed.descriptionEs },
    address: {
      line1: parsed.line1,
      line2: parsed.line2,
      city: parsed.city,
      province: parsed.province,
      postalCode: parsed.postalCode,
      country: 'CA',
    },
    geo: parsed.lat !== null && parsed.lng !== null
      ? { lat: parsed.lat, lng: parsed.lng }
      : null,
    phone: parsed.phone,
    email: parsed.email,
    websiteUrl: parsed.websiteUrl,
    socials: {
      facebook: parsed.facebook,
      instagram: parsed.instagram,
      x: null,
      tiktok: null,
    },
    hours: parsed.hours,
    logoUrl: parsed.logoUrl,
    heroUrl: parsed.heroUrl,
    photos: parsed.photos,
    tags: parsed.tags,
    counts: { offers: 0, jobs: 0 },
    rank: TIER_RANK.stub,
    claimedAt: null,
    source: 'seed',
    createdAt: now,
    updatedAt: now,
  };
}

/** Fields the seed may refresh on an existing stub. Never touches owner-only state. */
function refreshableFields(next: Business): Partial<Business> {
  return {
    name: next.name,
    sortName: next.sortName,
    category: next.category,
    categories: next.categories,
    address: next.address,
    geo: next.geo,
    phone: next.phone,
    email: next.email,
    websiteUrl: next.websiteUrl,
    socials: next.socials,
    tags: next.tags,
    hours: next.hours,
    logoUrl: next.logoUrl,
    heroUrl: next.heroUrl,
    photos: next.photos,
    updatedAt: next.updatedAt,
  };
}

/** A create writes the whole document; a merge only refreshes imported fields. */
type PendingWrite =
  | { kind: 'create'; id: string; data: Business }
  | { kind: 'merge'; id: string; data: Partial<Business> };

// ---------------------------------------------------------------------- main

export async function main(): Promise<void> {
  const options = parseArgs(argv.slice(2));

  if (options.emulator && !process.env['FIRESTORE_EMULATOR_HOST']) {
    process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:8080';
  }
  const usingEmulator = Boolean(process.env['FIRESTORE_EMULATOR_HOST']);

  const csv = await readFile(options.file, 'utf8').catch(() =>
    fail(`Cannot read ${options.file}`),
  );
  const rows = parseCsvRows(csv);
  if (rows.length === 0) fail('CSV has no data rows.');

  initializeApp({
    // The emulator needs no credentials; production uses ADC.
    ...(usingEmulator ? {} : { credential: applicationDefault() }),
    ...(options.projectId ? { projectId: options.projectId } : {}),
  });
  const db = getFirestore();
  const businesses = db.collection(COLLECTIONS.businesses).withConverter(businessConverter);

  // One read of the whole collection. For a single town this is a few hundred
  // documents, and it is what lets slug generation stay collision-free without
  // a query per row.
  const existingSnapshot = await businesses.get();
  const takenSlugs = new Set<string>();
  const byDedupeKey = new Map<string, Business>();
  const bySlug = new Map<string, Business>();

  for (const doc of existingSnapshot.docs) {
    const business = doc.data();
    takenSlugs.add(business.slug);
    bySlug.set(business.slug, business);
    byDedupeKey.set(dedupeKey(business.name, business.address.postalCode), business);
  }

  const now = new Date();
  const stats = { created: 0, updated: 0, skippedClaimed: 0, skippedInvalid: 0, duplicates: 0 };
  const seenThisRun = new Set<string>();
  const writes: PendingWrite[] = [];

  let processed = 0;
  for (const row of rows) {
    if (processed >= options.limit) break;
    processed += 1;

    const parsed = parseRow(row);
    if (!parsed) {
      stats.skippedInvalid += 1;
      continue;
    }

    const key = dedupeKey(parsed.name, parsed.postalCode);
    if (seenThisRun.has(key)) {
      stats.duplicates += 1;
      continue;
    }
    seenThisRun.add(key);

    const existing =
      byDedupeKey.get(key) ?? bySlug.get(slugify(parsed.name)) ?? null;

    if (existing) {
      if (existing.tier !== 'stub') {
        stats.skippedClaimed += 1;
        continue;
      }
      // Keep the existing slug. It is already a public URL.
      const next = toBusiness(parsed, existing.id, existing.slug, now);
      writes.push({ kind: 'merge', id: existing.id, data: refreshableFields(next) });
      stats.updated += 1;
      continue;
    }

    const slug = uniqueSlug(parsed.name, takenSlugs, {
      // Two "Mario's" in one town are disambiguated by street before falling
      // back to `-2`, which reads better in a URL.
      hint: parsed.line1 || parsed.postalCode,
      fallback: 'leamington-business',
    });
    const ref = businesses.doc();
    writes.push({ kind: 'create', id: ref.id, data: toBusiness(parsed, ref.id, slug, now) });
    stats.created += 1;
  }

  console.log(
    [
      `file           ${options.file}`,
      `rows           ${rows.length} (processed ${processed})`,
      `target         ${usingEmulator ? `emulator ${process.env['FIRESTORE_EMULATOR_HOST']}` : `project ${options.projectId ?? '(default)'}`}`,
      `existing       ${existingSnapshot.size}`,
      '',
      `create         ${stats.created}`,
      `update         ${stats.updated}`,
      `skip (claimed) ${stats.skippedClaimed}`,
      `skip (no name) ${stats.skippedInvalid}`,
      `skip (dupe)    ${stats.duplicates}`,
    ].join('\n'),
  );

  if (!options.commit) {
    console.log('\nDry run. Nothing written. Re-run with --commit to apply.');
    const preview = writes
      .filter((write) => write.kind === 'create')
      .slice(0, 5);
    for (const write of preview) {
      console.log(`  + ${write.data.slug.padEnd(34)} ${write.data.name}`);
    }
    if (stats.created > preview.length) {
      console.log(`  … and ${stats.created - preview.length} more`);
    }
    return;
  }

  const BATCH_LIMIT = 400;
  for (let index = 0; index < writes.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    for (const write of writes.slice(index, index + BATCH_LIMIT)) {
      if (write.kind === 'merge') {
        // A merge patch is encoded explicitly: going through the converter
        // would demand a complete model, and absent fields must stay absent so
        // nothing outside `refreshableFields` is touched.
        batch.set(
          db.collection(COLLECTIONS.businesses).doc(write.id),
          encodePartial(businessCodec, write.data),
          { merge: true },
        );
      } else {
        batch.set(businesses.doc(write.id), write.data);
      }
    }
    await batch.commit();
    console.log(`committed ${Math.min(index + BATCH_LIMIT, writes.length)}/${writes.length}`);
  }

  console.log('Done.');
}

// Only run when invoked directly, so the pure helpers above can be imported
// and exercised without touching Firestore.
if (import.meta.filename === argv[1]) {
  main().catch((error: unknown) => {
    console.error(error);
    exit(1);
  });
}
