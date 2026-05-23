// WebAuthn (Face ID, Fingerprint) utilities — server-challenge flow

export async function isBiometricAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    return available ?? false;
  } catch {
    return false;
  }
}

// ---- Registration (called from Settings/Profile when logged in) ----

export async function registerBiometric(): Promise<void> {
  // 1. Get options from server (requires active session)
  const optRes = await fetch("/api/auth/webauthn/register-options", {
    credentials: "include",
  });
  if (!optRes.ok) {
    const err = await optRes.json();
    throw new Error(err.message || "Impossible d'obtenir les options d'enregistrement");
  }
  const options = await optRes.json();

  // 2. Convert challenge and user.id from base64url to ArrayBuffer
  const publicKey: PublicKeyCredentialCreationOptions = {
    ...options,
    challenge: base64urlToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64urlToBuffer(options.user.id),
    },
    excludeCredentials: (options.excludeCredentials ?? []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
    // Remove hints field — not supported in all browsers
    hints: undefined,
  };

  // 3. Browser prompts Face ID / fingerprint
  console.log("[WebAuthn] Calling navigator.credentials.create with options:", publicKey);
  let credential: Credential | null;
  try {
    credential = await navigator.credentials.create({ publicKey });
  } catch (err: any) {
    console.error("[WebAuthn] navigator.credentials.create failed:", err);
    throw new Error(`Le navigateur a refusé la biométrie : ${err.message}`);
  }
  if (!credential) throw new Error("Enregistrement annulé");
  console.log("[WebAuthn] Credential created:", credential.id);

  // 4. Send result to server
  const payload = credentialToJSON(credential as PublicKeyCredential);
  console.log("[WebAuthn] Sending registration payload to server:", payload);
  const regRes = await fetch("/api/auth/webauthn/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  const regData = await regRes.json();
  console.log("[WebAuthn] Server registration response:", regRes.status, regData);
  if (!regRes.ok) {
    throw new Error(regData.message || "Échec de l'enregistrement biométrique");
  }
}

// ---- Authentication (called from Login page) ----

export async function loginWithBiometric(email: string): Promise<{ user: any }> {
  // 1. Get challenge + allowed credentials from server
  const optRes = await fetch("/api/auth/webauthn/auth-options", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!optRes.ok) {
    const err = await optRes.json();
    throw new Error(err.message || "Aucune biométrie enregistrée pour ce compte");
  }
  const options = await optRes.json();
  const { userId, ...authOptions } = options;

  // 2. Convert challenge and credential ids
  const publicKey: PublicKeyCredentialRequestOptions = {
    ...authOptions,
    challenge: base64urlToBuffer(authOptions.challenge),
    allowCredentials: (authOptions.allowCredentials ?? []).map((c: any) => ({
      ...c,
      id: base64urlToBuffer(c.id),
    })),
  };

  // 3. Browser prompts Face ID / fingerprint
  const assertion = await navigator.credentials.get({ publicKey });
  if (!assertion) throw new Error("Authentification annulée");

  // 4. Send assertion + userId to server
  const authRes = await fetch("/api/auth/webauthn/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      userId,
      assertion: assertionToJSON(assertion as PublicKeyCredential),
    }),
  });
  if (!authRes.ok) {
    const err = await authRes.json();
    throw new Error(err.message || "Authentification biométrique échouée");
  }
  return authRes.json();
}

// ---- Helpers ----

function credentialToJSON(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      attestationObject: bufferToBase64url(response.attestationObject),
    },
  };
}

function assertionToJSON(assertion: PublicKeyCredential) {
  const response = assertion.response as AuthenticatorAssertionResponse;
  return {
    id: assertion.id,
    rawId: bufferToBase64url(assertion.rawId),
    type: assertion.type,
    response: {
      clientDataJSON: bufferToBase64url(response.clientDataJSON),
      authenticatorData: bufferToBase64url(response.authenticatorData),
      signature: bufferToBase64url(response.signature),
      userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
    },
  };
}

function base64urlToBuffer(base64url: string): ArrayBuffer {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}