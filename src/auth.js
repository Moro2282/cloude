const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

const AUTH = `${SUPABASE_URL}/auth/v1`;
const HEADERS = { "Content-Type": "application/json", "apikey": SUPABASE_KEY };

// ─── TOKEN STORAGE ────────────────────────────────────────────────────────────
export function getSession() {
  try { return JSON.parse(localStorage.getItem("sb_session")); } catch { return null; }
}
export function setSession(session) {
  if (session) localStorage.setItem("sb_session", JSON.stringify(session));
  else localStorage.removeItem("sb_session");
}
export function getAuthHeaders() {
  const s = getSession();
  return s ? { ...HEADERS, "Authorization": `Bearer ${s.access_token}` } : HEADERS;
}

// ─── AUTH ACTIONS ─────────────────────────────────────────────────────────────
export async function signInEmail(email, password) {
  const res = await fetch(`${AUTH}/token?grant_type=password`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login gagal");
  setSession(data);
  return data;
}

export async function signUpEmail(email, password, fullName, role = "viewer") {
  const res = await fetch(`${AUTH}/signup`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ email, password, data: { full_name: fullName, role } }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Registrasi gagal");
  return data;
}

export async function signOut() {
  const s = getSession();
  if (s) {
    await fetch(`${AUTH}/logout`, {
      method: "POST",
      headers: { ...HEADERS, "Authorization": `Bearer ${s.access_token}` },
    }).catch(() => {});
  }
  setSession(null);
}

export async function signInGoogle() {
  const redirectTo = window.location.origin;
  window.location.href = `${AUTH}/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;
}

export async function refreshSession() {
  const s = getSession();
  if (!s?.refresh_token) return null;
  const res = await fetch(`${AUTH}/token?grant_type=refresh_token`, {
    method: "POST", headers: HEADERS,
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  if (!res.ok) { setSession(null); return null; }
  const data = await res.json();
  setSession(data);
  return data;
}

export async function handleOAuthCallback() {
  const hash = window.location.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace("#", "?"));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token) return null;
  const session = { access_token, refresh_token, token_type: "bearer" };
  setSession(session);
  window.history.replaceState({}, "", window.location.pathname);
  return session;
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────
export async function getUserProfile(userId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=*`,
    { headers: { ...HEADERS, "Authorization": `Bearer ${getSession()?.access_token}` } }
  );
  const data = await res.json();
  return data?.[0] || null;
}

export async function getCurrentUser() {
  const s = getSession();
  if (!s) return null;
  const res = await fetch(`${AUTH}/user`, {
    headers: { ...HEADERS, "Authorization": `Bearer ${s.access_token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  const profile = await getUserProfile(user.id);
  return { ...user, profile };
}

export async function getAllUsers() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?select=*&order=created_at.asc`,
    { headers: { ...HEADERS, "Authorization": `Bearer ${getSession()?.access_token}` } }
  );
  return res.ok ? res.json() : [];
}

export async function updateUserRole(userId, role) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`,
    {
      method: "PATCH",
      headers: { ...HEADERS, "Authorization": `Bearer ${getSession()?.access_token}`, "Prefer": "return=representation" },
      body: JSON.stringify({ role }),
    }
  );
  if (!res.ok) throw new Error("Gagal update role");
  return res.json();
}

export async function deleteUser(userId) {
  // Delete from user_profiles (cascade will handle auth.users via admin API)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`,
    { method: "DELETE", headers: { ...HEADERS, "Authorization": `Bearer ${getSession()?.access_token}` } }
  );
  if (!res.ok) throw new Error("Gagal hapus user");
}
