import { Env } from '../models/common.model';
import { UserRole } from '../models/user.model';

const FIREBASE_CERTS_URL = "https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken@system.gserviceaccount.com";

/**
 * FirebaseAuthService class for managing Firebase authentication
 */
export class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private projectId: string | undefined;
  
  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {}
  
  /**
   * Get the singleton instance of FirebaseAuthService
   */
  public static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
  }
  
  /**
   * Initialize the Firebase Auth service with environment variables
   */
  public initialize(env: Env): void {
    this.projectId = env.FIREBASE_PROJECT_ID;
    if (!this.projectId) {
      throw new AuthError("missing_project_id");
    }
  }
  
  /**
   * Verify Firebase ID token and return decoded payload
   */
  public async verifyIdToken(idToken: string): Promise<any> {
    if (!this.projectId) {
      throw new AuthError("service_not_initialized");
    }
    
    return await verifyFirebaseToken(idToken, this.projectId);
  }
  
  /**
   * Extract user role from decoded token
   */
  public getUserRole(decodedToken: any): UserRole {
    // Check if claims exist and contain role information
    if (decodedToken.claims && decodedToken.claims.role) {
      const role = decodedToken.claims.role;
      
      if (role === 'admin') return UserRole.ADMIN;
      if (role === 'manager') return UserRole.MANAGER;
      
      return UserRole.CUSTOMER;
    }
    
    // Default role if not specified
    return UserRole.CUSTOMER;
  }
}

/* ---------- core verification ---------- */
async function verifyFirebaseToken(idToken: string, projectId: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new AuthError("malformed_token");

  const [rawHeader, rawPayload, rawSig] = parts;
  const header = JSON.parse(base64UrlDecodeToString(rawHeader));
  const payload = JSON.parse(base64UrlDecodeToString(rawPayload));

  // Basic claim checks before signature (quick rejects)
  if (payload.aud !== projectId) throw new AuthError("invalid_audience");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`)
    throw new AuthError("invalid_issuer");
  if (!payload.auth_time && !payload.iat) throw new AuthError("missing_iat");
  if (payload.exp * 1000 < Date.now()) throw new AuthError("token_expired");

  // Get cached certs map { kid: pem }
  const certs = await fetchGoogleCertsCached();

  const pem = certs[header.kid];
  if (!pem) throw new AuthError("unknown_kid");

  // Import the PEM cert's public key (spki/DER) and verify signature
  const pubKey = await importPemAsCryptoKey(pem);
  const data = new TextEncoder().encode(`${rawHeader}.${rawPayload}`);
  const signature = base64UrlToUint8Array(rawSig);

  const verified = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    pubKey,
    signature,
    data
  );
  if (!verified) throw new AuthError("invalid_signature");

  // All good
  return payload;
}

/* ---------- caching Google certs using caches.default ---------- */
async function fetchGoogleCertsCached(): Promise<Record<string, string>> {
  // Check if we're in a Cloudflare Worker environment
  if (typeof caches !== 'undefined') {
    const cache = await caches.open('default');
    const cacheKey = new Request(FIREBASE_CERTS_URL, { method: "GET" });

    // Try cache first
    let cached = await cache.match(cacheKey);
    if (cached) {
      const json: Record<string, string> = await cached.json();
      return json;
    }

    // Fetch from origin
    const res = await fetch(FIREBASE_CERTS_URL);
    if (!res.ok) throw new Error("failed_fetch_google_certs");

    // Read max-age from cache-control header to set TTL for edge cache
    const cacheControl = res.headers.get("cache-control") || "";
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const ttl = maxAgeMatch ? Number(maxAgeMatch[1]) : 300; // fallback 5m

    // Store JSON map in edge cache with TTL
    const json = await res.json();
    // Store a Response containing the JSON so cache.match works
    const respForCache = new Response(JSON.stringify(json), {
      headers: { "Content-Type": "application/json" },
    });
    // Put into edge cache with explicit TTL
    await cache.put(cacheKey, respForCache.clone());

    return json as Record<string, string>;
  } else {
    // Fallback for local development or non-Cloudflare environments
    const res = await fetch(FIREBASE_CERTS_URL);
    if (!res.ok) throw new Error("failed_fetch_google_certs");
    const json = await res.json();
    return json as Record<string, string>;
  }
}

/* ---------- helpers ---------- */
function base64UrlDecodeToString(b64u: string) {
  const s = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + padding(b64u));
  return s;
}
function base64UrlToUint8Array(b64u: string) {
  const base64 = b64u.replace(/-/g, "+").replace(/_/g, "/") + padding(b64u);
  const binary = atob(base64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function padding(b: string) {
  return "==".slice(0, (4 - (b.length % 4)) % 4);
}

async function importPemAsCryptoKey(pem: string) {
  // Remove header/footer and newlines => DER binary
  const b64 = pem
    .replace(/-----BEGIN CERTIFICATE-----/, "")
    .replace(/-----END CERTIFICATE-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

  // Import the certificate as SPKI public key
  return crypto.subtle.importKey("spki", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
}

/* ---------- custom error ---------- */
class AuthError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.name = "AuthError";
    this.code = code;
  }
}