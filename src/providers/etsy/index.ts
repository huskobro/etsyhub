// Phase 9 V1 Task 4 — Etsy provider barrel.
// Public API: types, registry, oauth, connection, errors.
// Provider impl (client.ts) ve error-classifier yalnız internal kullanım için
// dışarı export edilmez (registry üzerinden erişim).

export type * from "./types";
export {
  getEtsyProvider,
  listEtsyProviders,
  DEFAULT_ETSY_PROVIDER_ID,
} from "./registry";
export {
  resolveEtsyConnection,
  hasEtsyConnection,
} from "./connection";
export {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  isEtsyConfigured,
  ETSY_DEFAULT_SCOPES,
  ETSY_AUTH_URL,
  ETSY_TOKEN_URL,
} from "./oauth";
export {
  EtsyNotConfiguredError,
  EtsyConnectionNotFoundError,
  EtsyTokenMissingError,
  EtsyTokenExpiredError,
  EtsyApiError,
  EtsyRateLimitError,
  EtsyValidationError,
  EtsyNetworkError,
} from "./errors";
export { isRetryableEtsyError } from "./error-classifier";

// Phase 9 V1 — OAuth callback + Settings panel slice (additive).
export {
  getEtsyConnectionStatus,
  persistEtsyConnection,
  deleteEtsyConnection,
  type EtsyConnectionStatus,
} from "./connection.service";
export {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
} from "./pkce";
export {
  setOAuthStateCookie,
  readOAuthStateCookie,
  clearOAuthStateCookie,
} from "./oauth-state-cookie";

// Phase 9 V1 — Taxonomy mapping (additive).
export {
  resolveEtsyTaxonomyId,
  tryResolveEtsyTaxonomyId,
  resetTaxonomyCache,
  EtsyTaxonomyConfigError,
  EtsyTaxonomyMissingError,
} from "./taxonomy";
