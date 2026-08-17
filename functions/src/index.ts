/**
 * Function entry points. Firebase discovers exports from this file.
 *
 * Everything that writes /clickouts, /redemptions and /subscriptions lives
 * behind these functions — security rules deny those writes to every client.
 */

import './options.js';

export { recordClickout } from './clickouts.js';
export { issueRedemption, confirmRedemption } from './redemptions.js';
export { buildDailyFeed, rebuildFeed } from './feed.js';
export { sendDailyPush } from './push.js';
export { runHousekeeping } from './expiry.js';
export { assignBusinessOwner } from './claims.js';
export { onBusinessWritten, onOfferWritten, onJobWritten } from './denormalize.js';
export {
  onBusinessChangedRebuild,
  onOfferChangedRebuild,
  onJobChangedRebuild,
  rebuildSiteIfDirty,
  rebuildSite,
} from './netlify.js';
