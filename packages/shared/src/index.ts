/**
 * @leamington/shared — types, Firestore converters and i18n.
 *
 * Per CLAUDE.md this is the only place types and converters live. Apps,
 * functions and scripts import from here; nothing redeclares a model shape.
 */

// Types
export * from './types/common.js';
export * from './types/business.js';
export * from './types/offer.js';
export * from './types/job.js';
export * from './types/feed.js';
export * from './types/clickout.js';
export * from './types/redemption.js';
export * from './types/subscription.js';
export * from './types/user.js';

// Firestore
export * from './firestore/converter.js';
export * from './firestore/paths.js';
export * as fields from './firestore/fields.js';

// Converters
export * from './converters/business.js';
export * from './converters/offer.js';
export * from './converters/job.js';
export * from './converters/feed.js';
export * from './converters/clickout.js';
export * from './converters/redemption.js';
export * from './converters/subscription.js';
export * from './converters/user.js';

// Utilities
export * from './slug.js';
export * from './dates.js';
export * from './format.js';
export * from './categories.js';
export * from './hours.js';

// i18n
export * from './i18n/index.js';
