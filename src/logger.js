const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

function getSession() {
  try { return JSON.parse(localStorage.getItem("sb_session")); }
  catch { return null; }
}

export async function logActivity({ action, module, description, metadata = {} }) {
  try {
    const session = getSession();
    if (!session?.user) return; // don't log if not logged in

    const profile = JSON.parse(localStorage.getItem("sb_profile") || "{}");

    await fetch(`${SUPABASE_URL}/rest/v1/activity_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${session.access_token}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        user_id: session.user.id,
        user_name: profile.full_name || session.user.email,
        user_role: profile.role || "viewer",
        action,
        module,
        description,
        metadata,
      }),
    });
  } catch(e) {
    // Silently fail - logging should never break the app
    console.warn("Log failed:", e.message);
  }
}
