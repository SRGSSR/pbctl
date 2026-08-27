// The engine facade: the only engine module the frontend imports.

export {
  assignMedia,
  createFolder,
  deleteFolder,
  renameFolder,
  unassignMedia,
} from './commands/folders';
export type { MediaDocument } from './commands/media';
export {
  deleteMedia,
  restoreMedia,
  saveMedia,
  toDocument,
} from './commands/media';
export type { Config, Profile } from './config/profile';
export {
  DEFAULT_SCOPES,
  defaultConfigPath,
  discoveryUrl,
  ProfileStore,
} from './config/profile';
export type { ApiRequest } from './connection/client';
export { ApiError, apiRequest } from './connection/client';
export type { Connection, ProbeResult } from './connection/connection';
export { createConnection, probeBackend } from './connection/connection';
export type { IdentityProviderHint } from './connection/detect';
export { detectIdentityProvider, parseAuthorizeUrl } from './connection/detect';
export { failureMessage } from './connection/failure';
export type { Identity } from './connection/identity';
export { identityOf } from './connection/identity';
export type {
  DeviceAuthorization,
  Discovery,
  PollOptions,
  TokenSet,
} from './connection/oidc';
export {
  fetchDiscovery,
  pollForToken,
  refreshTokens,
  requestDeviceCode,
} from './connection/oidc';
export { setTlsVerification } from './connection/tls';
export type { Folder, FolderAccess } from './queries/folders';
export { folderAccess, listFolders } from './queries/folders';
export type {
  Media,
  MediaMetadata,
  MediaPage,
  MediaScope,
  MediaSource,
  MediaVisibility,
} from './queries/media';
export { getMedia, listFolderMedia, listMedia } from './queries/media';
