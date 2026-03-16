/**
 * FIT (Forge Invocation Token) Provider.
 *
 * Generates RSA key pairs and signs JWTs for Forge Remote invocations.
 * Keys are persisted to `.forge-sim/fit-keys/` so they survive restarts.
 */

import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  generateKeyPair,
  exportJWK,
  exportPKCS8,
  importPKCS8,
  SignJWT,
  type CryptoKey,
  type KeyObject,
  type JWK,
} from 'jose';

const ALG = 'RS256';
const KID = 'forge-sim-1';

export interface FITClaims {
  /** Audience — app ID from manifest */
  aud: string;
  /** App metadata */
  app?: {
    id: string;
    version?: string;
    installationId?: string;
    environment?: {
      type: string;
      id: string;
    };
    module?: {
      type: string;
      key: string;
    };
  };
  /** Context object embedded in the token */
  context?: {
    cloudId?: string;
    siteUrl?: string;
    moduleKey?: string;
    localId?: string;
  };
  /** Principal — the acting user's account ID */
  principal?: string;
  /** OAuth app system token (if available) */
  appSystemToken?: string;
  /** OAuth app user token (if available) */
  appUserToken?: string;
}

export class FITProvider {
  private privateKey: CryptoKey | KeyObject | null = null;
  private publicJWK: JWK | null = null;
  private initialized = false;

  /**
   * Initialize the FIT provider — loads or generates RSA keys.
   * Keys are stored in `<appDir>/.forge-sim/fit-keys/`.
   */
  async init(appDir: string): Promise<void> {
    const keyDir = join(appDir, '.forge-sim', 'fit-keys');
    const privatePath = join(keyDir, 'private.pem');
    const jwksPath = join(keyDir, 'jwks.json');

    try {
      // Try loading existing keys
      const pem = await readFile(privatePath, 'utf-8');
      const jwksRaw = await readFile(jwksPath, 'utf-8');
      this.privateKey = await importPKCS8(pem, ALG);
      const jwks = JSON.parse(jwksRaw);
      this.publicJWK = jwks.keys[0];
      this.initialized = true;
      return;
    } catch (err: any) {
      // Keys don't exist or are corrupt/incompatible — regenerate
      // Common: "CryptoKey is not extractable" when key was saved by different crypto backend
      if (err?.code !== 'ENOENT') {
        console.warn(`[fit] Regenerating keys: ${err.message}`);
      }
    }

    const { privateKey, publicKey } = await generateKeyPair(ALG, { extractable: true });
    this.privateKey = privateKey;

    // Export public key as JWK
    const jwk = await exportJWK(publicKey);
    jwk.kid = KID;
    jwk.alg = ALG;
    jwk.use = 'sig';
    this.publicJWK = jwk;

    // Export private key as PEM
    const pem = await exportPKCS8(privateKey);

    // Persist to disk
    await mkdir(keyDir, { recursive: true });
    await writeFile(privatePath, pem, 'utf-8');
    await writeFile(jwksPath, JSON.stringify({ keys: [jwk] }, null, 2), 'utf-8');

    this.initialized = true;
  }

  /**
   * Initialize with in-memory keys only (no disk persistence).
   * Useful for testing.
   */
  async initInMemory(): Promise<void> {
    const { privateKey, publicKey } = await generateKeyPair(ALG, { extractable: true });
    this.privateKey = privateKey;

    const jwk = await exportJWK(publicKey);
    jwk.kid = KID;
    jwk.alg = ALG;
    jwk.use = 'sig';
    this.publicJWK = jwk;

    this.initialized = true;
  }

  /**
   * Sign a FIT JWT with the given claims.
   */
  async sign(claims: FITClaims): Promise<string> {
    if (!this.privateKey) {
      throw new Error('FITProvider not initialized. Call init() or initInMemory() first.');
    }

    const builder = new SignJWT({
      app: claims.app,
      context: claims.context,
      principal: claims.principal,
      ...(claims.appSystemToken ? { appSystemToken: claims.appSystemToken } : {}),
      ...(claims.appUserToken ? { appUserToken: claims.appUserToken } : {}),
    })
      .setProtectedHeader({ alg: ALG, kid: KID })
      .setIssuer('forge-sim')
      .setAudience(claims.aud)
      .setIssuedAt()
      .setExpirationTime('5m');

    return builder.sign(this.privateKey);
  }

  /**
   * Return the public JWKS document (for serving at /__forge/jwks.json).
   */
  getJWKS(): { keys: JWK[] } {
    if (!this.publicJWK) {
      return { keys: [] };
    }
    return { keys: [this.publicJWK] };
  }

  get isInitialized(): boolean {
    return this.initialized;
  }
}
