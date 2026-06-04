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
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`,
    { method: "DELETE", headers: { ...HEADERS, "Authorization": `Bearer ${getSession()?.access_token}` } }
  );
  if (!res.ok) throw new Error("Gagal hapus user");
}

// Change own password (user must be logged in)
export async function changePassword(newPassword) {
  const s = getSession();
  if (!s) throw new Error("Tidak ada sesi aktif");
  const res = await fetch(`${AUTH}/user`, {
    method: "PUT",
    headers: { ...HEADERS, "Authorization": `Bearer ${s.access_token}` },
    body: JSON.stringify({ password: newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Gagal ganti password");
  return data;
}

// Admin reset password for another user via signup (re-invite)
// Since we cannot call admin API from browser, we use signUp with same email
// Better: update via Supabase admin endpoint using service role - but we use workaround
// Practical approach: admin creates new session for target user
export async function adminResetPassword(email, newPassword) {
  // We use the signUp endpoint with upsert approach
  // This won't work without service_role key
  // So we store a pending reset that user sees on next login
  // Practical solution: use Supabase dashboard or store temp password
  // For browser-only app, we create a special reset record
  const res = await fetch(`${SUPABASE_URL}/rest/v1/password_resets`, {
    method: "POST",
    headers: { ...HEADERS, "Authorization": `Bearer ${getSession()?.access_token}`, "Prefer": "return=representation" },
    body: JSON.stringify({ email, new_password: newPassword, created_by: getSession()?.user?.id, used: false }),
  });
  if (!res.ok) throw new Error("Gagal simpan reset password");
  return res.json();
}

export async function checkPendingReset(email) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/password_resets?email=eq.${encodeURIComponent(email)}&used=eq.false&order=created_at.desc&limit=1`,
    { headers: HEADERS }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data?.[0] || null;
}

export async function markResetUsed(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/password_resets?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...HEADERS, "Authorization": `Bearer ${getSession()?.access_token}` },
    body: JSON.stringify({ used: true }),
  });
}
