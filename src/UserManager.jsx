import { useState, useEffect } from "react";
import { getAllUsers, signUpEmail, updateUserRole, deleteUser } from "./auth";

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
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email:"", password:"", fullName:"", role:"viewer" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { load(); }, []);

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
      setForm({ email:"", password:"", fullName:"", role:"viewer" });
      setShowAdd(false);
      setTimeout(load, 1000);
    } catch (e) { notify(e.message, "error"); }
    setSaving(false);
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

  return (
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
                </div>
                {/* Role selector */}
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
                {/* Delete */}
                <button onClick={()=>handleDelete(user)} disabled={user.id===currentUser.id} style={{ padding:"5px 10px", borderRadius:6, border:"1px solid #7f1d1d", background:"#1c0a0a", color: user.id===currentUser.id?"#334155":"#ef4444", cursor: user.id===currentUser.id?"not-allowed":"pointer", fontSize:12 }}>
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
