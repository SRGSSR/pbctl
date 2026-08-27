// Loads and saves the configuration file that holds the profiles.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** A saved backend connection profile. Tokens are never part of it. */
export interface Profile {
  /** Profile name, for example `prod`. */
  name: string;
  /** Base URL of the pillarbox backend. */
  backend: string;
  /** Issuer URL of the OIDC identity provider. */
  issuer: string;
  /** The public OIDC client pbctl authenticates as. */
  clientId: string;
  /** The OIDC scopes requested at login. */
  scopes: string[];
  /** Whether to verify TLS certificates. */
  tlsVerify: boolean;
}

/** The content of the configuration file (`~/.config/pbctl/config.json`). */
export interface Config {
  /** The saved profiles. */
  profiles: Profile[];
}

/** The scopes a profile requests when the wizard answer is left empty. */
export const DEFAULT_SCOPES: readonly string[] = ['openid', 'profile'];

/**
 * Returns the default configuration file path.
 *
 * @returns The path `~/.config/pbctl/config.json`.
 */
export function defaultConfigPath(): string {
  return join(homedir(), '.config', 'pbctl', 'config.json');
}

/**
 * Returns the OIDC discovery document URL of an issuer.
 *
 * @param issuer - The issuer URL, with or without a trailing slash.
 * @returns The `.well-known/openid-configuration` URL under the issuer.
 */
export function discoveryUrl(issuer: string): string {
  return `${issuer.replace(/\/+$/, '')}/.well-known/openid-configuration`;
}

/** Loads and saves the profiles in the configuration file. */
export class ProfileStore {
  /** The configuration file path. */
  private readonly path: string;

  /**
   * Creates a store for the given file.
   *
   * @param path - The configuration file path, the default path when omitted.
   */
  constructor(path: string = defaultConfigPath()) {
    this.path = path;
  }

  /**
   * Loads the configuration file.
   *
   * @returns The parsed configuration, or an empty one when the file does not
   * exist.
   */
  load(): Config {
    let text: string;
    try {
      text = readFileSync(this.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { profiles: [] };
      }
      throw error;
    }
    return parseConfig(text, this.path);
  }

  /**
   * Saves the configuration file, creating its directory when needed.
   *
   * @param config - The configuration to save.
   * @returns Nothing.
   */
  private save(config: Config): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(config, null, 2)}\n`, {
      mode: 0o600,
    });
  }

  /**
   * Adds or replaces a profile by name.
   *
   * @param profile - The profile to save.
   * @returns The updated configuration.
   */
  upsert(profile: Profile): Config {
    const others = this.load().profiles.filter(
      (existing) => existing.name !== profile.name,
    );
    const updated: Config = { profiles: [...others, profile] };
    this.save(updated);
    return updated;
  }

  /**
   * Deletes the named profile.
   *
   * @param name - The profile name.
   * @returns Whether a profile was deleted.
   */
  remove(name: string): boolean {
    const config = this.load();
    const remaining = config.profiles.filter(
      (profile) => profile.name !== name,
    );
    if (remaining.length === config.profiles.length) {
      return false;
    }
    this.save({ profiles: remaining });
    return true;
  }
}

/**
 * Parses and validates the raw configuration file content.
 *
 * @param text - The raw file content.
 * @param path - The file path, used in error messages.
 * @returns The parsed configuration.
 */
function parseConfig(text: string, path: string): Config {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${(error as Error).message}`);
  }
  const config = parsed as Config;
  if (!Array.isArray(config.profiles)) {
    throw new Error(
      `Invalid configuration in ${path}: "profiles" must be an array.`,
    );
  }
  return config;
}
