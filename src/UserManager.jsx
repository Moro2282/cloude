import { useState, useEffect } from "react";
import { getAllUsers, signUpEmail, updateUserRole, deleteUser } from "./auth";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

async function getTeamMembers() {
  const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members?order=name.asc&is_active=eq.true`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
  });
  return res.ok ? res.json() : [];
}

async function linkUserToTeam(userId, teamMemberId) {
  const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
    method: "PATCH",
    headers: { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${token}`, "Prefer":"return=representation" },
    body: JSON.stringify({ team_member_id: teamMemberId || null }),
  });
  if (!res.ok) throw new Error("Gagal link ke tim");
}
import ResetPasswordModal from "./ResetPasswordModal";

const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:14, marginTop:4, outline:"none", fontFamily:"inherit", boxSizing:"border-box" };
const MINI = { background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:14 };

const ROLE_CONFIG = {
  admin:   { color:"#a78bfa", bg:"#1e1040", label:"Admin",   desc:"Semua akses" },
  editor:  { color:"#38bdf8", bg:"#0c2a3f", label:"Editor",  desc:"Edit & tambah" },
  trainer: { color:"#f59e0b", bg:"#451a03", label:"Trainer", desc:"Input training" },
  viewer:  { color:"#64748b", bg:"#0f172a", label:"Viewer",  desc:"Lihat saja" },
};

function RoleBadge({ role }) {
  const c = ROLE_CONFIG[role] || ROLE_CONFIG.viewer;
  return <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:c.bg, color:c.color }}>{c.label}</span>;
}

export default function UserManager({ currentUser, onClose }) {
  const [users, setUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email:"", password:"", fullName:"", role:"viewer", teamMemberId:"" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null);
  const [editNameTarget, setEditNameTarget] = useState(null);
  const [editNameValue, setEditNameValue] = useState("");

  useEffect(() => { load(); getTeamMembers().then(setTeamMembers).catch(()=>{}); }, []);

  const load = async () => {
    setLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  const notify = (text, type="success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleAdd = async () => {
    if (!form.email || !form.password || !form.fullName) { notify("Semua field wajib diisi", "error"); return; }
    setSaving(true);
    try {
      await signUpEmail(form.email, form.password, form.fullName, form.role);
      notify(`Akun ${form.email} berhasil dibuat!`);
      // Link to team member if selected
      setTimeout(async () => {
        if (form.teamMemberId) {
          const newUsers = await getAllUsers();
          const newUser = newUsers.find(u => u.email === form.email);
          if (newUser) await linkUserToTeam(newUser.id, form.teamMemberId).catch(()=>{});
        }
        load();
      }, 1000);
      setForm({ email:"", password:"", fullName:"", role:"viewer", teamMemberId:"" });
      setShowAdd(false);
    } catch (e) { notify(e.message, "error"); }
    setSaving(false);
  };

  const handleLinkTeam = async (userId, teamMemberId) => {
    try {
      await linkUserToTeam(userId, teamMemberId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, team_member_id: teamMemberId } : u));
      notify("Berhasil dikaitkan ke anggota tim!");
      setLinkTarget(null);
    } catch(e) { notify(e.message, "error"); }
  };

  const handleRenameUser = async (userId, newName) => {
    if (!newName.trim()) return;
    const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${token}`, "Prefer":"return=representation" },
        body: JSON.stringify({ full_name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Gagal update nama");
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, full_name: newName.trim() } : u));
      notify(`Nama berhasil diubah ke "${newName.trim()}"!`);
    } catch(e) { notify(e.message, "error"); }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      notify("Role berhasil diupdate");
    } catch (e) { notify(e.message, "error"); }
  };

  const handleDelete = async (user) => {
    if (user.id === currentUser.id) { notify("Tidak bisa hapus akun sendiri", "error"); return; }
    if (!window.confirm(`Hapus akun ${user.email}?`)) return;
    try {
      await deleteUser(user.id);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      notify("Akun berhasil dihapus");
    } catch (e) { notify(e.message, "error"); }
  };

  const handleResetPassword = async (userId, email, newPassword) => {
    // Use Supabase Auth Admin API via REST
    const { getSession } = await import("./auth");
    // Since we cannot call admin API from browser with anon key,
    // we use signUpEmail which will update password if email exists via upsert
    // Best approach: inform user to use the Supabase dashboard or use service role
    // Practical: we sign in as admin and use the update endpoint
    const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
    const session = JSON.parse(localStorage.getItem("sb_session"));
    // Update password using admin endpoint - requires service_role but we try with user token
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    });
    if (!res.ok) {
      // Fallback: store in password_resets table for user to see
      throw new Error("Reset via admin API gagal. Gunakan Supabase Dashboard → Authentication → Users → Edit user untuk reset manual.");
    }
    notify(`Password ${email} berhasil direset!`);
    setResetTarget(null);
  };

  return (
    <>
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:28, maxWidth:680, width:"100%", maxHeight:"90vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:18, fontWeight:700, color:"#f1f5f9" }}>👥 Kelola Pengguna</div>
            <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>{users.length} pengguna terdaftar</div>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={()=>setShowAdd(!showAdd)} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"#1d4ed8", color:"#fff", cursor:"pointer", fontWeight:600, fontSize:13 }}>+ Tambah User</button>
            <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:22, cursor:"pointer" }}>✕</button>
          </div>
        </div>

        {/* Notification */}
        {msg && (
          <div style={{ background: msg.type==="error"?"#1c0a0a":"#052e16", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}`, borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color: msg.type==="error"?"#ef4444":"#10b981" }}>
            {msg.type==="error"?"⚠️":"✓"} {msg.text}
          </div>
        )}

        {/* Role legend */}
        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {Object.entries(ROLE_CONFIG).map(([role, c]) => (
            <div key={role} style={{ ...MINI, padding:"8px 14px", display:"flex", gap:8, alignItems:"center" }}>
              <RoleBadge role={role} />
              <span style={{ fontSize:12, color:"#475569" }}>{c.desc}</span>
            </div>
          ))}
        </div>

        {/* Add user form */}
        {showAdd && (
          <div style={{ ...MINI, marginBottom:20, borderColor:"#1d4ed8" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#e2e8f0", marginBottom:14 }}>Buat Akun Baru</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Nama Lengkap *</label>
                <input style={INP} placeholder="Nama tim" value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Email *</label>
                <input type="email" style={INP} placeholder="email@domain.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Password *</label>
                <input type="password" style={INP} placeholder="Min. 8 karakter" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Role *</label>
                <select style={{ ...INP, cursor:"pointer" }} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
                  <option value="admin">Admin — Semua akses</option>
                  <option value="editor">Editor — Edit & tambah</option>
                  <option value="trainer">Trainer — Input training</option>
                  <option value="viewer">Viewer — Lihat saja</option>
                </select>
              </div>
              {teamMembers.length > 0 && (
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={{ fontSize:11, color:"#64748b" }}>Kaitkan ke Anggota Tim (opsional)</label>
                  <select style={{ ...INP, cursor:"pointer" }} value={form.teamMemberId} onChange={e=>setForm(f=>({...f,teamMemberId:e.target.value}))}>
                    <option value="">— Tidak dikaitkan —</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}{m.position?` (${m.position})`:""}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display:"none" }}>
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={handleAdd} disabled={saving} style={{ padding:"8px 20px", borderRadius:8, border:"none", background: saving?"#1e293b":"#059669", color: saving?"#475569":"#fff", cursor: saving?"not-allowed":"pointer", fontWeight:600, fontSize:13 }}>
                {saving?"Membuat...":"Buat Akun"}
              </button>
              <button onClick={()=>setShowAdd(false)} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:13 }}>Batal</button>
            </div>
          </div>
        )}

        {/* User list */}
        {loading ? (
          <div style={{ textAlign:"center", padding:40, color:"#475569" }}>Memuat...</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {users.map(user => (
              <div key={user.id} style={{ ...MINI, display:"flex", alignItems:"center", gap:14 }}>
                {/* Avatar */}
                <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#fff", flexShrink:0 }}>
                  {(user.full_name||user.email).charAt(0).toUpperCase()}
                </div>
                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#e2e8f0", display:"flex", alignItems:"center", gap:8 }}>
                    {user.full_name || "—"}
                    {user.id === currentUser.id && <span style={{ fontSize:10, color:"#475569", background:"#0f172a", padding:"2px 8px", borderRadius:999, border:"1px solid #1e293b" }}>Anda</span>}
                  </div>
                  <div style={{ fontSize:12, color:"#475569" }}>{user.email}</div>
                {user.team_member_id && (() => {
                  const tm = teamMembers.find(m => m.id === user.team_member_id);
                  if (tm && user.full_name !== tm.name) return (
                    <div onClick={()=>handleRenameUser(user.id, tm.name)} style={{ fontSize:11, color:"#f59e0b", marginTop:3, cursor:"pointer" }}>
                      💡 Pakai nama tim: <span style={{ fontWeight:700 }}>{tm.name}</span>
                    </div>
                  );
                  return null;
                })()}
                </div>
                {/* Role selector */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                  <select
                    value={user.role}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                    disabled={user.id === currentUser.id}
                    style={{ background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"5px 10px", color: ROLE_CONFIG[user.role]?.color || "#e2e8f0", fontSize:12, cursor: user.id===currentUser.id?"not-allowed":"pointer", outline:"none", fontWeight:600 }}>
                    <option value="admin">Admin</option>
                    <option value="editor">Editor</option>
                    <option value="trainer">Trainer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  {teamMembers.length > 0 && (
                    <button onClick={()=>setLinkTarget(user)} style={{ fontSize:10, padding:"2px 8px", borderRadius:6, border:"1px solid #334155", background:"transparent", color: user.team_member_id ? "#10b981" : "#475569", cursor:"pointer" }}>
                      {user.team_member_id ? `🔗 ${teamMembers.find(m=>m.id===user.team_member_id)?.name||"Tertaut"}` : "🔗 Taut ke Tim"}
                    </button>
                  )}
                </div>
                {/* Delete */}
                <button onClick={()=>setResetTarget(user)} disabled={user.id===currentUser.id} title="Reset Password" style={{ padding:"5px 10px", borderRadius:6, border:"1px solid #1d4ed8", background:"#0c1628", color: user.id===currentUser.id?"#334155":"#38bdf8", cursor: user.id===currentUser.id?"not-allowed":"pointer", fontSize:12, marginRight:4 }}>
                  🔑
                </button>
                <button onClick={()=>handleDelete(user)} disabled={user.id===currentUser.id} style={{ padding:"5px 10px", borderRadius:6, border:"1px solid #7f1d1d", background:"#1c0a0a", color: user.id===currentUser.id?"#334155":"#ef4444", cursor: user.id===currentUser.id?"not-allowed":"pointer", fontSize:12 }}>
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onReset={handleResetPassword} />}
    {linkTarget && (
      <div style={{ position:"fixed", inset:0, background:"#00000088", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={()=>setLinkTarget(null)}>
        <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:28, maxWidth:400, width:"100%", fontFamily:"inherit" }} onClick={e=>e.stopPropagation()}>
          <div style={{ fontSize:16, fontWeight:700, color:"#f1f5f9", marginBottom:16 }}>🔗 Taut ke Anggota Tim</div>
          <div style={{ fontSize:13, color:"#475569", marginBottom:16 }}>User: <span style={{ color:"#e2e8f0", fontWeight:600 }}>{linkTarget.full_name || linkTarget.email}</span></div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:280, overflowY:"auto", marginBottom:16 }}>
            <button onClick={()=>handleLinkTeam(linkTarget.id, null)} style={{ padding:"10px 14px", borderRadius:10, border:`1px solid ${!linkTarget.team_member_id?"#ef4444":"#1e293b"}`, background:!linkTarget.team_member_id?"#1c0a0a":"transparent", color:!linkTarget.team_member_id?"#ef4444":"#64748b", cursor:"pointer", textAlign:"left", fontSize:13 }}>
              ✕ Tidak dikaitkan
            </button>
            {teamMembers.map(m => (
              <button key={m.id} onClick={()=>handleLinkTeam(linkTarget.id, m.id)} style={{ padding:"10px 14px", borderRadius:10, border:`1px solid ${linkTarget.team_member_id===m.id?"#10b981":"#1e293b"}`, background:linkTarget.team_member_id===m.id?"#052e16":"transparent", color:linkTarget.team_member_id===m.id?"#10b981":"#e2e8f0", cursor:"pointer", textAlign:"left", fontSize:13 }}>
                <div style={{ fontWeight:600 }}>{m.name}</div>
                {m.position && <div style={{ fontSize:11, color:"#475569" }}>{m.position}</div>}
              </button>
            ))}
          </div>
          <button onClick={()=>setLinkTarget(null)} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:13 }}>Tutup</button>
        </div>
      </div>
    )}
    </>
  );
}