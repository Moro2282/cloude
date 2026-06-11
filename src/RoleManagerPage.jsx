import { useState, useEffect } from "react";
import { logActivity } from "./logger";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

function getToken() {
  try { return JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY; }
  catch { return SUPABASE_KEY; }
}
function hdrs() {
  return { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${getToken()}`, "Prefer":"return=representation" };
}
async function dbGet(table, params="") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers: hdrs() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method:"POST", headers:hdrs(), body:JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbPatch(table, filter, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method:"PATCH", headers:hdrs(), body:JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbDelete(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { method:"DELETE", headers:hdrs() });
  if (!res.ok) throw new Error(await res.text());
}
async function dbUpsert(table, body, conflict) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${conflict}`, {
    method:"POST", headers:{ ...hdrs(), "Prefer":"resolution=merge-duplicates,return=representation" }, body:JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const MODULES = [
  { key:"dashboard",      label:"📁 Dashboard",      actions:["lihat","tambah_proyek","edit_proyek","hapus_proyek"] },
  { key:"laporan",        label:"📊 Laporan",         actions:["lihat","export"] },
  { key:"komisi",         label:"💰 Komisi",          actions:["lihat","export"] },
  { key:"jadwal",         label:"📅 Jadwal Aktivitas",actions:["lihat","tambah","edit","hapus"] },
  { key:"data_master",    label:"🗂 Data Master",     actions:["lihat","tambah","edit","hapus"] },
  { key:"kalender",       label:"🗓 Kalender",        actions:["lihat"] },
  { key:"layanan_teknis", label:"🔧 Layanan Teknis",  actions:["lihat","tambah","edit","hapus"] },
  { key:"users",          label:"👥 Users",           actions:["lihat","tambah","edit","hapus"] },
  { key:"logs",           label:"📋 Log Aktivitas",   actions:["lihat","hapus"] },
];

const ACTION_LABELS = {
  lihat:"👁 Lihat", tambah:"➕ Tambah", edit:"✏️ Edit", hapus:"🗑 Hapus",
  export:"⬇️ Export", tambah_proyek:"➕ Tambah Proyek",
  edit_proyek:"✏️ Edit Proyek", hapus_proyek:"🗑 Hapus Proyek",
};

const COLORS = ["#a78bfa","#38bdf8","#10b981","#f59e0b","#ef4444","#fb923c","#e879f9","#34d399"];

function notify(setter, text, type="success") {
  setter({ text, type });
  setTimeout(() => setter(null), 3000);
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <div onClick={disabled ? undefined : onChange} style={{
      width:36, height:20, borderRadius:999, cursor:disabled?"not-allowed":"pointer",
      background:checked?"#10b981":"#1e293b", position:"relative", transition:"background 0.2s",
      opacity:disabled?0.4:1, flexShrink:0,
    }}>
      <div style={{ position:"absolute", top:2, left:checked?18:2, width:16, height:16, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function RoleManagerPage({ onClose }) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Add role form
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#38bdf8");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        dbGet("roles", "?order=created_at.asc"),
        dbGet("role_permissions", "?order=role_name.asc,module.asc,action.asc"),
      ]);
      setRoles(r);
      setPermissions(p);
      if (!selectedRole && r.length > 0) setSelectedRole(r[0].name);
    } catch(e) { notify(setMsg, e.message, "error"); }
    setLoading(false);
  };

  // Get permission value
  const getPerm = (roleName, module, action) => {
    const p = permissions.find(p => p.role_name === roleName && p.module === module && p.action === action);
    return p?.allowed || false;
  };

  // Toggle single permission
  const togglePerm = async (roleName, module, action, currentVal) => {
    if (roleName === "admin") { notify(setMsg, "Permission Admin tidak bisa diubah", "error"); return; }
    setSaving(true);
    try {
      await dbUpsert("role_permissions", { role_name: roleName, module, action, allowed: !currentVal }, "role_name,module,action");
      setPermissions(prev => {
        const existing = prev.findIndex(p => p.role_name === roleName && p.module === module && p.action === action);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], allowed: !currentVal };
          return updated;
        }
        return [...prev, { role_name: roleName, module, action, allowed: !currentVal }];
      });
      notify(setMsg, `Permission diupdate!`);
      logActivity({ action:"edit", module:"roles", description:`Ubah permission ${roleName}: ${module}.${action}` });
    } catch(e) { notify(setMsg, e.message, "error"); }
    setSaving(false);
  };

  // Toggle all actions in a module
  const toggleModule = async (roleName, module, actions, allOn) => {
    if (roleName === "admin") return;
    setSaving(true);
    try {
      const newVal = !allOn;
      await Promise.all(actions.map(action =>
        dbUpsert("role_permissions", { role_name: roleName, module, action, allowed: newVal }, "role_name,module,action")
      ));
      setPermissions(prev => {
        const updated = [...prev];
        actions.forEach(action => {
          const idx = updated.findIndex(p => p.role_name === roleName && p.module === module && p.action === action);
          if (idx >= 0) updated[idx] = { ...updated[idx], allowed: newVal };
          else updated.push({ role_name: roleName, module, action, allowed: newVal });
        });
        return updated;
      });
      notify(setMsg, `Semua permission ${module} ${newVal ? "diaktifkan" : "dinonaktifkan"}!`);
    } catch(e) { notify(setMsg, e.message, "error"); }
    setSaving(false);
  };

  // Copy permissions from another role
  const copyFromRole = async (sourceRole, targetRole) => {
    if (targetRole === "admin") return;
    if (!window.confirm(`Salin semua permission dari "${sourceRole}" ke "${targetRole}"? Permission yang ada akan ditimpa.`)) return;
    setSaving(true);
    try {
      const sourcePerm = permissions.filter(p => p.role_name === sourceRole);
      await Promise.all(sourcePerm.map(p =>
        dbUpsert("role_permissions", { role_name: targetRole, module: p.module, action: p.action, allowed: p.allowed }, "role_name,module,action")
      ));
      setPermissions(prev => {
        const filtered = prev.filter(p => p.role_name !== targetRole);
        const copied = sourcePerm.map(p => ({ ...p, role_name: targetRole }));
        return [...filtered, ...copied];
      });
      notify(setMsg, `Permission berhasil disalin dari "${sourceRole}" ke "${targetRole}"!`);
    } catch(e) { notify(setMsg, e.message, "error"); }
    setSaving(false);
  };

  // Add new role
  const handleAddRole = async () => {
    if (!newRoleName.trim()) { notify(setMsg, "Nama role wajib diisi", "error"); return; }
    const name = newRoleName.trim().toLowerCase().replace(/\s+/g, "_");
    if (roles.find(r => r.name === name)) { notify(setMsg, "Role sudah ada", "error"); return; }
    setSaving(true);
    try {
      await dbPost("roles", { name, color: newRoleColor, is_system: false });
      // Init all permissions as false
      const allPerms = MODULES.flatMap(m => m.actions.map(a => ({ role_name: name, module: m.key, action: a, allowed: false })));
      await Promise.all(allPerms.map(p => dbUpsert("role_permissions", p, "role_name,module,action")));
      notify(setMsg, `Role "${name}" berhasil dibuat!`);
      setNewRoleName(""); setShowAddRole(false);
      await loadAll();
      setSelectedRole(name);
    } catch(e) { notify(setMsg, e.message, "error"); }
    setSaving(false);
  };

  // Delete role
  const handleDeleteRole = async (role) => {
    if (role.is_system) { notify(setMsg, "Role sistem tidak bisa dihapus", "error"); return; }
    if (!window.confirm(`Hapus role "${role.name}"? User yang menggunakan role ini akan perlu di-assign ulang.`)) return;
    setSaving(true);
    try {
      await dbDelete("role_permissions", `role_name=eq.${role.name}`);
      await dbDelete("roles", `id=eq.${role.id}`);
      notify(setMsg, `Role "${role.name}" dihapus!`);
      setSelectedRole(roles.find(r => r.name !== role.name)?.name || null);
      await loadAll();
    } catch(e) { notify(setMsg, e.message, "error"); }
    setSaving(false);
  };

  // Update role color
  const handleUpdateRoleColor = async (role, color) => {
    try {
      await dbPatch("roles", `id=eq.${role.id}`, { color });
      setRoles(prev => prev.map(r => r.id === role.id ? { ...r, color } : r));
    } catch(e) { notify(setMsg, e.message, "error"); }
  };

  const selectedRoleData = roles.find(r => r.name === selectedRole);
  const INP = { background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" };

  return (
    <div style={{ position:"fixed", inset:0, background:"#060d1a", zIndex:2000, overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0c1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:3px}`}</style>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28, flexWrap:"wrap", gap:16 }}>
          <div>
            <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, marginBottom:8, padding:0 }}>← Kembali ke Dashboard</button>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#f1f5f9", margin:0 }}>🔐 Role & Permission</h1>
            <div style={{ fontSize:13, color:"#475569", marginTop:4 }}>Atur hak akses per role untuk setiap fitur aplikasi</div>
          </div>
        </div>

        {/* Notification */}
        {msg && (
          <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:16, fontSize:13, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>
            {msg.type==="error"?"⚠️":"✓"} {msg.text}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#475569" }}>Memuat data role & permission...</div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:20 }}>

            {/* Left: Role List */}
            <div>
              <div style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:16, padding:16, marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Role</div>
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {roles.map(role => (
                    <div key={role.id} onClick={()=>setSelectedRole(role.name)} style={{
                      display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:10,
                      cursor:"pointer", border:`1px solid ${selectedRole===role.name?role.color+"66":"transparent"}`,
                      background:selectedRole===role.name?"#0a1525":"transparent", transition:"all 0.15s",
                    }}
                      onMouseEnter={e=>{ if(selectedRole!==role.name) e.currentTarget.style.background="#0a1525"; }}
                      onMouseLeave={e=>{ if(selectedRole!==role.name) e.currentTarget.style.background="transparent"; }}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:role.color, flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", textTransform:"capitalize" }}>{role.name}</div>
                        <div style={{ fontSize:10, color:"#475569" }}>{role.is_system ? "Role Sistem" : "Role Custom"}</div>
                      </div>
                      {selectedRole === role.name && !role.is_system && (
                        <button onClick={e=>{e.stopPropagation();handleDeleteRole(role);}} style={{ padding:"2px 6px", borderRadius:4, border:"1px solid #7f1d1d", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:10 }}>🗑</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Add role */}
              {!showAddRole ? (
                <button onClick={()=>setShowAddRole(true)} style={{ width:"100%", padding:"9px", borderRadius:10, border:"1px dashed #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:13, fontWeight:600 }}>+ Tambah Role Baru</button>
              ) : (
                <div style={{ background:"#0c1628", border:"1px solid #1d4ed8", borderRadius:12, padding:14 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#38bdf8", marginBottom:10 }}>Tambah Role Baru</div>
                  <input style={{ ...INP, width:"100%", marginBottom:10 }} placeholder="Nama role (contoh: supervisor)" value={newRoleName} onChange={e=>setNewRoleName(e.target.value)} />
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, color:"#64748b", marginBottom:6 }}>Warna</div>
                    <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                      {COLORS.map(c => (
                        <div key={c} onClick={()=>setNewRoleColor(c)} style={{ width:24, height:24, borderRadius:"50%", background:c, cursor:"pointer", border:`2px solid ${newRoleColor===c?"#fff":"transparent"}`, flexShrink:0 }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={handleAddRole} disabled={saving} style={{ flex:1, padding:"7px", borderRadius:8, border:"none", background:"#1d4ed8", color:"#fff", cursor:"pointer", fontWeight:600, fontSize:12 }}>Buat Role</button>
                    <button onClick={()=>{setShowAddRole(false);setNewRoleName("");}} style={{ padding:"7px 12px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:12 }}>Batal</button>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Permission Matrix */}
            {selectedRoleData && (
              <div style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:16, padding:20 }}>
                {/* Role header */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:selectedRoleData.color+"22", border:`1px solid ${selectedRoleData.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔐</div>
                    <div>
                      <div style={{ fontSize:18, fontWeight:800, color:"#f1f5f9", textTransform:"capitalize" }}>{selectedRoleData.name}</div>
                      <div style={{ fontSize:12, color:"#475569" }}>{selectedRoleData.is_system ? "Role sistem (tidak bisa dihapus)" : "Role custom"}</div>
                    </div>
                    {/* Color picker for non-system roles */}
                    {!selectedRoleData.is_system && (
                      <div style={{ display:"flex", gap:4 }}>
                        {COLORS.map(c => (
                          <div key={c} onClick={()=>handleUpdateRoleColor(selectedRoleData, c)} style={{ width:16, height:16, borderRadius:"50%", background:c, cursor:"pointer", border:`2px solid ${selectedRoleData.color===c?"#fff":"transparent"}` }} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Copy from role */}
                  {selectedRoleData.name !== "admin" && (
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:12, color:"#475569" }}>Salin dari:</span>
                      {roles.filter(r => r.name !== selectedRole).map(r => (
                        <button key={r.name} onClick={()=>copyFromRole(r.name, selectedRole)} style={{ padding:"5px 12px", borderRadius:8, border:`1px solid ${r.color}44`, background:"transparent", color:r.color, cursor:"pointer", fontSize:11, fontWeight:600, textTransform:"capitalize" }}>
                          {r.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedRoleData.name === "admin" && (
                  <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:16, background:"#1e1040", border:"1px solid #a78bfa33", fontSize:13, color:"#a78bfa" }}>
                    🔒 Admin memiliki semua permission dan tidak dapat diubah
                  </div>
                )}

                {/* Permission matrix */}
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {MODULES.map(mod => {
                    const modPerms = mod.actions.map(a => getPerm(selectedRole, mod.key, a));
                    const allOn = modPerms.every(Boolean);
                    const someOn = modPerms.some(Boolean);
                    return (
                      <div key={mod.key} style={{ background:"#0a1525", border:"1px solid #1a2744", borderRadius:12, overflow:"hidden" }}>
                        {/* Module header */}
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", borderBottom:"1px solid #1a2744", background:"#0f1a2e" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ width:8, height:8, borderRadius:"50%", background: allOn?"#10b981":someOn?"#f59e0b":"#334155" }} />
                            <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{mod.label}</span>
                            <span style={{ fontSize:11, color:"#334155" }}>{modPerms.filter(Boolean).length}/{mod.actions.length} aktif</span>
                          </div>
                          {selectedRoleData.name !== "admin" && (
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:11, color:"#475569" }}>{allOn?"Nonaktifkan semua":"Aktifkan semua"}</span>
                              <Toggle checked={allOn} onChange={()=>toggleModule(selectedRole, mod.key, mod.actions, allOn)} />
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))", gap:0 }}>
                          {mod.actions.map((action, idx) => {
                            const allowed = getPerm(selectedRole, mod.key, action);
                            return (
                              <div key={action} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", borderRight: idx%2===0?"1px solid #1a2744":"none", borderBottom:"1px solid #1a274422" }}>
                                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                                  <span style={{ fontSize:12, color: allowed?"#e2e8f0":"#334155" }}>{ACTION_LABELS[action] || action}</span>
                                </div>
                                <Toggle
                                  checked={allowed}
                                  onChange={()=>togglePerm(selectedRole, mod.key, action, allowed)}
                                  disabled={selectedRoleData.name === "admin"}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {saving && <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#475569" }}>Menyimpan...</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
