import { useState, useEffect } from "react";
import NewClientProjectModal from "./NewClientProjectModal";

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
async function dbPatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method:"PATCH", headers:hdrs(), body:JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbDelete(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method:"DELETE", headers:hdrs() });
  if (!res.ok) throw new Error(await res.text());
}

const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };
const MINI = { background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:14 };
const BTN = { padding:"9px 20px", borderRadius:8, border:"none", background:"#1d4ed8", color:"#fff", cursor:"pointer", fontWeight:600, fontSize:13 };

function notify(setter, text, type="success") {
  setter({ text, type });
  setTimeout(() => setter(null), 3000);
}

// ─── MASTER TIM ───────────────────────────────────────────────────────────────
function TeamSection({ isAdmin }) {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name:"", position:"" });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const d = await dbGet("team_members","?order=name.asc");
    setMembers(d); setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notify(setMsg,"Nama wajib diisi","error"); return; }
    // Validasi duplikat nama tim
    const nameLower = form.name.trim().toLowerCase();
    const duplicate = members.find(m => m.name.trim().toLowerCase() === nameLower && m.id !== editId);
    if (duplicate) { notify(setMsg, `Nama "${duplicate.name}" sudah ada di Master Tim!`, "error"); return; }
    try {
      if (editId) await dbPatch("team_members", editId, { name:form.name.trim(), position:form.position });
      else await dbPost("team_members", { name:form.name.trim(), position:form.position });
      notify(setMsg, editId ? "Berhasil diupdate!" : "Anggota tim ditambahkan!");
      setForm({ name:"", position:"" }); setEditId(null); load();
    } catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleDelete = async (id) => {
    const member = members.find(m=>m.id===id);
    const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
    try {
      // Cek jadwal aktivitas yang menggunakan anggota ini
      const actRes = await fetch(`https://kfhbrodsgurvrsfpecwq.supabase.co/rest/v1/team_activities?team_member_ids=cs.["${id}"]&select=id&limit=1`, {headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ","Authorization":`Bearer ${token}`}}).then(r=>r.json()).catch(()=>[]);
      // Cek training sessions
      const sessRes = await fetch(`https://kfhbrodsgurvrsfpecwq.supabase.co/rest/v1/training_sessions?trainer_name=eq.${encodeURIComponent(member?.name||"")}&select=id&limit=1`, {headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ","Authorization":`Bearer ${token}`}}).then(r=>r.json()).catch(()=>[]);
      const hasAct = Array.isArray(actRes) && actRes.length > 0;
      const hasSess = Array.isArray(sessRes) && sessRes.length > 0;
      if (hasAct || hasSess) {
        const detail = [];
        if (hasAct) detail.push("jadwal aktivitas");
        if (hasSess) detail.push("sesi layanan teknis");
        notify(setMsg, `❌ Anggota "${member?.name}" tidak dapat dihapus karena masih terdapat ${detail.join(" dan ")} terkait.`, "error");
        return;
      }
    } catch(e) { /* lanjut */ }
    if (!window.confirm(`Hapus anggota tim "${member?.name}"?`)) return;
    try { await dbDelete("team_members", id); load(); notify(setMsg,"Berhasil dihapus!"); }
    catch(e) { notify(setMsg, e.message, "error"); }
  };

  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || (m.position||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {msg && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:12, fontSize:12, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>{msg.text}</div>}

      {isAdmin && (
        <div style={{ ...MINI, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:10 }}>{editId ? "✏️ Edit Anggota Tim" : "➕ Tambah Anggota Tim"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={{ fontSize:11, color:"#64748b" }}>Nama *</label>
              <input style={{ ...INP, borderColor: form.name.trim() && members.find(m=>m.name.trim().toLowerCase()===form.name.trim().toLowerCase()&&m.id!==editId) ? "#ef4444" : "#1e293b" }}
                value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nama lengkap" />
              {form.name.trim() && members.find(m=>m.name.trim().toLowerCase()===form.name.trim().toLowerCase()&&m.id!==editId) && (
                <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>⚠️ Nama ini sudah ada di Master Tim</div>
              )}
            </div>
            <div><label style={{ fontSize:11, color:"#64748b" }}>Posisi / Jabatan</label><input style={INP} value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="Sales, Teknisi, dll" /></div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handleSave} style={BTN}>{editId ? "💾 Update" : "+ Tambah"}</button>
            {editId && <button onClick={()=>{setEditId(null);setForm({name:"",position:""});}} style={{ ...BTN, background:"transparent", border:"1px solid #334155", color:"#64748b" }}>Batal</button>}
          </div>
        </div>
      )}

      <div style={{ position:"relative", marginBottom:12 }}>
        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:12 }}>🔍</span>
        <input style={{ ...INP, marginTop:0, paddingLeft:30 }} placeholder="Cari anggota tim..." value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      <div style={{ fontSize:12, color:"#475569", marginBottom:10 }}>{filtered.length} anggota tim</div>

      {loading ? <div style={{ textAlign:"center", color:"#475569", padding:30 }}>Memuat...</div> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:10 }}>
          {filtered.map(m => (
            <div key={m.id} style={{ ...MINI, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:800, fontSize:16, flexShrink:0 }}>
                {m.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{m.name}</div>
                <div style={{ fontSize:11, color:"#475569" }}>{m.position || "—"}</div>
              </div>
              {isAdmin && (
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  <button onClick={()=>{setEditId(m.id);setForm({name:m.name,position:m.position||""});window.scrollTo({top:0,behavior:"smooth"});}} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #1d4ed8", background:"transparent", color:"#38bdf8", cursor:"pointer", fontSize:11 }}>✏️</button>
                  <button onClick={()=>handleDelete(m.id)} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #7f1d1d", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:11 }}>🗑</button>
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color:"#334155", padding:20, gridColumn:"1/-1", textAlign:"center" }}>Belum ada anggota tim</div>}
        </div>
      )}
    </div>
  );
}

// ─── MASTER PERUSAHAAN ────────────────────────────────────────────────────────

// ─── LINK PROJECT MODAL ──────────────────────────────────────────────────────
function LinkProjectModal({ company, projects, onClose, onLinked }) {
  const SUPA_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
  const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const linked = projects.filter(p => p.company_id === company.id);
  const unlinked = projects.filter(p =>
    !p.company_id && // only show projects with no company yet
    (p.name.toLowerCase().includes(search.toLowerCase()) ||
     (p.client||"").toLowerCase().includes(search.toLowerCase()))
  );

  const handleLink = async (projectId) => {
    // Cek: perusahaan sudah punya proyek lain?
    const alreadyLinked = projects.find(p => p.company_id === company.id && p.id !== projectId);
    if (alreadyLinked) {
      setMsg(`❌ Perusahaan ini sudah tertaut ke "${alreadyLinked.name}". Lepas tautan dulu.`);
      setTimeout(()=>setMsg(""),4000);
      return;
    }
    setSaving(true);
    try {
      const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPA_KEY;
      const res = await fetch(`${SUPA_URL}/rest/v1/projects?id=eq.${projectId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":`Bearer ${token}`,"Prefer":"return=minimal"},
        body: JSON.stringify({ company_id: company.id }),
      });
      if (!res.ok) throw new Error(await res.text());
      setMsg("Berhasil ditautkan!"); onLinked(projectId, company.id);
      setTimeout(()=>setMsg(""),2000);
    } catch(e) { setMsg("Gagal: "+e.message); }
    setSaving(false);
  };

  const handleUnlink = async (projectId) => {
    setSaving(true);
    try {
      const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPA_KEY;
      await fetch(`${SUPA_URL}/rest/v1/projects?id=eq.${projectId}`, {
        method:"PATCH", headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":`Bearer ${token}`,"Prefer":"return=minimal"},
        body: JSON.stringify({ company_id: null }),
      });
      onLinked(projectId, null); setMsg("Tautan dihapus");
      setTimeout(()=>setMsg(""),2000);
    } catch(e) { setMsg("Gagal: "+e.message); }
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:5000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:24, maxWidth:560, width:"100%", maxHeight:"85vh", overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
          <div><div style={{ fontSize:16, fontWeight:700, color:"#f1f5f9" }}>🔗 Tautkan Proyek ke Perusahaan</div>
            <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>{company.name}</div></div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        {msg && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:12, fontSize:12, background:"#052e16", color:"#10b981" }}>{msg}</div>}
        {linked.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#10b981", textTransform:"uppercase", letterSpacing:0.8, marginBottom:8 }}>Sudah Ditautkan ({linked.length})</div>
            {linked.map(p=>(
              <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 12px", background:"#052e16", border:"1px solid #10b98133", borderRadius:8, marginBottom:6 }}>
                <div><div style={{ fontSize:13, fontWeight:600, color:"#f1f5f9" }}>{p.name}</div><div style={{ fontSize:11, color:"#475569" }}>{p.client}</div></div>
                <button onClick={()=>handleUnlink(p.id)} disabled={saving} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:11 }}>Lepas</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize:11, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:0.8, marginBottom:8 }}>Pilih Proyek untuk Ditautkan</div>
        <div style={{ position:"relative", marginBottom:10 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:12 }}>🔍</span>
          <input style={{ width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px 8px 30px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            placeholder="Cari proyek..." value={search} onChange={e=>setSearch(e.target.value)} autoFocus />
        </div>
        <div style={{ maxHeight:260, overflowY:"auto", display:"flex", flexDirection:"column", gap:6 }}>
          {unlinked.length === 0
            ? <div style={{ textAlign:"center", padding:20, color:"#334155", fontSize:13 }}>{search?"Tidak ada yang cocok":"Semua proyek sudah ditautkan"}</div>
            : unlinked.map(p=>(
              <div key={p.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", background:"#0a1525", border:"1px solid #1a2744", borderRadius:8 }}>
                <div><div style={{ fontSize:13, fontWeight:600, color:"#f1f5f9" }}>{p.name}</div><div style={{ fontSize:11, color:"#475569" }}>Klien: {p.client||"-"}</div></div>
                <button onClick={()=>handleLink(p.id)} disabled={saving} style={{ padding:"5px 14px", borderRadius:8, border:"none", background:"#1d4ed8", color:"#fff", cursor:saving?"not-allowed":"pointer", fontSize:12, fontWeight:600 }}>Tautkan</button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

function CompanySection({ isAdmin, projects = [], onSelectProject }) {
  const [companies, setCompanies] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [form, setForm] = useState({ name:"", pic_name:"", pic_phone:"", address:"", status:"prospek", notes:"" });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandId, setExpandId] = useState(null);
  const [showPicPicker, setShowPicPicker] = useState(false);
  const [picSearch, setPicSearch] = useState("");
  const [newCompanyData, setNewCompanyData] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null); // triggers project form after save

  useEffect(() => { load(); loadTeam(); }, []);
  const load = async () => {
    setLoading(true);
    const d = await dbGet("companies","?order=name.asc");
    setCompanies(d); setLoading(false);
  };
  const loadTeam = async () => {
    try {
      const d = await dbGet("team_members","?order=name.asc&is_active=eq.true");
      setTeamMembers(d);
    } catch {}
  };

  const handleSave = async () => {
    if (!form.name.trim()) { notify(setMsg,"Nama perusahaan wajib diisi","error"); return; }

    // Cek duplikat nama (case-insensitive, trim whitespace)
    const nameLower = form.name.trim().toLowerCase();
    const duplicate = companies.find(c =>
      c.name.trim().toLowerCase() === nameLower && c.id !== editId
    );
    if (duplicate) {
      notify(setMsg, `Perusahaan "${duplicate.name}" sudah ada! Gunakan nama yang berbeda.`, "error");
      return;
    }

    try {
      const savedName = form.name.trim();
      if (editId) {
        await dbPatch("companies", editId, { ...form, name: savedName });
        notify(setMsg, "Perusahaan diupdate!");
      } else {
        const res = await dbPost("companies", { ...form, name: savedName });
        const saved = Array.isArray(res) ? res[0] : res;
        notify(setMsg, "Perusahaan ditambahkan!");
        // If status is klien, show project form
        if (form.status === "klien") {
          setNewCompanyData({ name: savedName, pic_name: form.pic_name, pic_phone: form.pic_phone });
        }
      }
      setForm({ name:"", pic_name:"", pic_phone:"", address:"", status:"prospek", notes:"" });
      setEditId(null); setShowPicPicker(false); setShowForm(false); load();
    } catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleDelete = async (id) => {
    const comp = companies.find(c=>c.id===id);
    // Cek: ada proyek terkait?
    const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
    try {
      const [projRes, actRes] = await Promise.all([
        fetch(`https://kfhbrodsgurvrsfpecwq.supabase.co/rest/v1/projects?company_id=eq.${id}&select=id,name&limit=1`, {headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ","Authorization":`Bearer ${token}`}}).then(r=>r.json()).catch(()=>[]),
        fetch(`https://kfhbrodsgurvrsfpecwq.supabase.co/rest/v1/team_activities?company_id=eq.${id}&select=id&limit=1`, {headers:{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ","Authorization":`Bearer ${token}`}}).then(r=>r.json()).catch(()=>[]),
      ]);
      const hasProject = Array.isArray(projRes) && projRes.length > 0;
      const hasActivity = Array.isArray(actRes) && actRes.length > 0;
      if (hasProject || hasActivity) {
        const detail = [];
        if (hasProject) detail.push(`proyek: "${projRes[0]?.name}"`);
        if (hasActivity) detail.push(`${actRes.length} jadwal aktivitas`);
        notify(setMsg, `❌ Perusahaan "${comp?.name}" tidak dapat dihapus karena masih ada ${detail.join(" dan ")}. Hapus transaksi terkait terlebih dahulu.`, "error");
        return;
      }
    } catch(e) { /* lanjut jika gagal cek */ }
    if (!window.confirm(`Hapus perusahaan "${comp?.name}"?`)) return;
    try { await dbDelete("companies", id); load(); notify(setMsg,"Berhasil dihapus!"); }
    catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleEdit = (c) => {
    setEditId(c.id);
    setForm({ name:c.name, pic_name:c.pic_name||"", pic_phone:c.pic_phone||"", address:c.address||"", status:c.status||"prospek", notes:c.notes||"" });
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search || c.name.toLowerCase().includes(q) || (c.pic_name||"").toLowerCase().includes(q) || (c.address||"").toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const klienCount = companies.filter(c => c.status === "klien").length;
  const prospekCount = companies.filter(c => c.status === "prospek").length;

  return (
    <>
    <div>
      {msg && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:12, fontSize:12, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>{msg.text}</div>}

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {[[companies.length,"Total","#38bdf8"],[klienCount,"Klien","#10b981"],[prospekCount,"Prospek","#f59e0b"]].map(([v,l,c])=>(
          <div key={l} style={{ background:"#060d1a", border:"1px solid #1a2744", borderRadius:10, padding:"12px 14px" }}>
            <div style={{ fontSize:24, fontWeight:800, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:"#475569" }}>{l}</div>
          </div>
        ))}
      </div>

      {isAdmin && !editId && (
        <div style={{ marginBottom:16 }}>
          {!showForm ? (
            <button onClick={()=>setShowForm(true)} style={{ padding:"9px 20px", borderRadius:10, border:"1px dashed #1d4ed8", background:"transparent", color:"#38bdf8", cursor:"pointer", fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:8 }}>
              ➕ Tambah Perusahaan Baru
            </button>
          ) : (
            <div style={{ ...MINI, border:"1px solid #1d4ed8" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                <div style={{ fontSize:12, fontWeight:600, color:"#38bdf8" }}>➕ Tambah Perusahaan Baru</div>
                <button onClick={()=>{setShowForm(false);setForm({name:"",pic_name:"",pic_phone:"",address:"",status:"prospek",notes:""});}} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:16 }}>✕</button>
              </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:11, color:"#64748b" }}>Nama Perusahaan *</label>
              <input style={{ ...INP, borderColor: form.name.trim() && companies.find(c => c.name.trim().toLowerCase() === form.name.trim().toLowerCase() && c.id !== editId) ? "#ef4444" : "#1e293b" }}
                value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="PT / CV / Nama Usaha" />
              {form.name.trim() && companies.find(c => c.name.trim().toLowerCase() === form.name.trim().toLowerCase() && c.id !== editId) && (
                <div style={{ fontSize:11, color:"#ef4444", marginTop:4, display:"flex", alignItems:"center", gap:4 }}>
                  ⚠️ Nama ini sudah terdaftar — gunakan nama yang berbeda
                </div>
              )}
            </div>
            <div>
              <label style={{ fontSize:11, color:"#64748b" }}>Nama PIC</label>
              {teamMembers.length > 0 && (
                <div style={{ marginTop:4, marginBottom:4 }}>
                  <button type="button" onClick={()=>setShowPicPicker(!showPicPicker)} style={{ padding:"4px 12px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer", border:`1px solid ${showPicPicker?"#38bdf8":"#1e293b"}`, background:showPicPicker?"#0c2a3f":"transparent", color:showPicPicker?"#38bdf8":"#475569" }}>
                    👥 Pilih dari Tim {showPicPicker ? "▲" : "▼"}
                  </button>
                  {showPicPicker && (
                    <div style={{ marginTop:6, background:"#060d1a", border:"1px solid #1e293b", borderRadius:10, padding:10 }}>
                      <input style={{ ...INP, marginTop:0, marginBottom:8 }} placeholder="Cari nama tim..." value={picSearch} onChange={e=>setPicSearch(e.target.value)} autoFocus />
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {teamMembers.filter(m=>m.name.toLowerCase().includes(picSearch.toLowerCase())).map(m=>(
                          <button key={m.id} type="button" onClick={()=>{setForm(f=>({...f,pic_name:m.name}));setShowPicPicker(false);setPicSearch("");}}
                            style={{ padding:"5px 12px", borderRadius:999, fontSize:12, fontWeight:600, cursor:"pointer", border:`1px solid ${form.pic_name===m.name?"#10b981":"#1e293b"}`, background:form.pic_name===m.name?"#052e16":"transparent", color:form.pic_name===m.name?"#10b981":"#e2e8f0" }}>
                            {form.pic_name===m.name && "✓ "}{m.name}{m.position?` (${m.position})`:""}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <input style={INP} value={form.pic_name} onChange={e=>setForm(f=>({...f,pic_name:e.target.value}))} placeholder="Ketik manual atau pilih dari tim" />
            </div>
            <div><label style={{ fontSize:11, color:"#64748b" }}>No. HP PIC</label><input style={INP} value={form.pic_phone} onChange={e=>setForm(f=>({...f,pic_phone:e.target.value}))} placeholder="08xx..." /></div>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Status</label>
              <div style={{ display:"flex", gap:6 }}>
                {[["prospek","Prospek","#f59e0b","#451a03"],["klien","Klien","#10b981","#052e16"]].map(([v,l,c,bg])=>(
                  <button key={v} onClick={()=>setForm(f=>({...f,status:v}))} style={{ flex:1, padding:"7px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.status===v?c:"#1e293b"}`, background:form.status===v?bg:"transparent", color:form.status===v?c:"#475569" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, color:"#64748b" }}>Alamat</label><input style={INP} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Alamat perusahaan" /></div>
            <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, color:"#64748b" }}>Catatan</label><textarea style={{ ...INP, resize:"vertical" }} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Info tambahan..." /></div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handleSave} style={BTN}>+ Tambah</button>
            <button onClick={()=>{setShowForm(false);setForm({name:"",pic_name:"",pic_phone:"",address:"",status:"prospek",notes:""}); }} style={{ ...BTN, background:"transparent", border:"1px solid #334155", color:"#64748b" }}>Batal</button>
          </div>
        </div>
          )}
        </div>
      )}

      {/* Edit form */}
      {isAdmin && editId && (
        <div style={{ ...MINI, marginBottom:16, border:"1px solid #f59e0b" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#f59e0b" }}>✏️ Edit Perusahaan</div>
            <button onClick={()=>{setEditId(null);setForm({name:"",pic_name:"",pic_phone:"",address:"",status:"prospek",notes:""}); }} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:16 }}>✕</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div style={{ gridColumn:"1/-1" }}>
              <label style={{ fontSize:11, color:"#64748b" }}>Nama Perusahaan *</label>
              <input style={{ ...INP, borderColor: form.name.trim() && companies.find(c => c.name.trim().toLowerCase() === form.name.trim().toLowerCase() && c.id !== editId) ? "#ef4444" : "#1e293b" }}
                value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
            </div>
            <div><label style={{ fontSize:11, color:"#64748b" }}>Nama PIC</label><input style={INP} value={form.pic_name} onChange={e=>setForm(f=>({...f,pic_name:e.target.value}))} /></div>
            <div><label style={{ fontSize:11, color:"#64748b" }}>No. HP PIC</label><input style={INP} value={form.pic_phone} onChange={e=>setForm(f=>({...f,pic_phone:e.target.value}))} /></div>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Status</label>
              <div style={{ display:"flex", gap:6 }}>
                {[["prospek","Prospek","#f59e0b","#451a03"],["klien","Klien","#10b981","#052e16"]].map(([v,l,c,bg])=>(
                  <button key={v} onClick={()=>setForm(f=>({...f,status:v}))} style={{ flex:1, padding:"7px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.status===v?c:"#1e293b"}`, background:form.status===v?bg:"transparent", color:form.status===v?c:"#475569" }}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, color:"#64748b" }}>Alamat</label><input style={INP} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} /></div>
            <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, color:"#64748b" }}>Catatan</label><textarea style={{ ...INP, resize:"vertical" }} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handleSave} style={BTN}>💾 Update</button>
            <button onClick={()=>{setEditId(null);setForm({name:"",pic_name:"",pic_phone:"",address:"",status:"prospek",notes:""});}} style={{ ...BTN, background:"transparent", border:"1px solid #334155", color:"#64748b" }}>Batal</button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, marginBottom:12, alignItems:"center" }}>
        <div style={{ position:"relative" }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:12 }}>🔍</span>
          <input style={{ ...INP, marginTop:0, paddingLeft:30 }} placeholder="Cari nama, PIC, atau alamat..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {[["all","Semua","#64748b"],["klien","Klien","#10b981"],["prospek","Prospek","#f59e0b"]].map(([v,l,c])=>(
            <button key={v} onClick={()=>setFilterStatus(v)} style={{ padding:"6px 14px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer", border:`1px solid ${filterStatus===v?c:"#1e293b"}`, background:filterStatus===v?"#0c1628":"transparent", color:filterStatus===v?c:"#475569" }}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize:12, color:"#475569", marginBottom:12 }}>{filtered.length} perusahaan</div>

      {loading ? <div style={{ textAlign:"center", color:"#475569", padding:30 }}>Memuat...</div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {filtered.map(c => {
            const isExpanded = expandId === c.id;
            const statusColor = c.status === "klien" ? "#10b981" : "#f59e0b";
            const statusBg = c.status === "klien" ? "#052e16" : "#451a03";
            return (
              <div key={c.id} onClick={()=>setSelectedCompany(sc=>sc?.id===c.id?null:c)} style={{ ...MINI, borderLeft:`3px solid ${statusColor}`, border:`1px solid ${selectedCompany?.id===c.id?statusColor:"#1a2744"}`, borderLeft:`3px solid ${statusColor}`, cursor:"pointer" }}>
                {/* Row — click name to show projects, click arrow to expand details */}
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{c.name}</span>
                      <span style={{ padding:"2px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:statusBg, color:statusColor }}>{c.status === "klien" ? "✅ Klien" : "🎯 Prospek"}</span>
                      {selectedCompany?.id===c.id && <span style={{ fontSize:10, color:statusColor }}>● lihat proyek</span>}
                    </div>
                    {c.pic_name && <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>👤 {c.pic_name} {c.pic_phone && `· 📞 ${c.pic_phone}`}</div>}
                    {c.address && !isExpanded && <div style={{ fontSize:11, color:"#334155", marginTop:2 }}>📍 {c.address.slice(0,50)}{c.address.length>50?"...":""}</div>}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
                    {isAdmin && <>
                      <button onClick={e=>{e.stopPropagation();setLinkTarget(c);}} title="Tautkan ke Proyek" style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #0d9488", background:"transparent", color:"#14b8a6", cursor:"pointer", fontSize:11 }}>🔗</button>
                      <button onClick={e=>{e.stopPropagation();handleEdit(c);}} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #1d4ed8", background:"transparent", color:"#38bdf8", cursor:"pointer", fontSize:11 }}>✏️</button>
                      <button onClick={e=>{e.stopPropagation();handleDelete(c.id);}} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #7f1d1d", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:11 }}>🗑</button>
                    </>}
                    <span onClick={e=>{e.stopPropagation();setExpandId(isExpanded?null:c.id);}} style={{ color:"#475569", fontSize:13, cursor:"pointer", padding:"2px 8px", borderRadius:4, background:"#0a1525" }} title="Lihat detail">{isExpanded?"▲":"▼"}</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ marginTop:12, borderTop:"1px solid #1e293b", paddingTop:12, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {[["📍 Alamat", c.address||"-"],["📝 Catatan", c.notes||"-"]].map(([l,v])=>(
                      <div key={l} style={{ background:"#060d1a", borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:"#475569", marginBottom:4 }}>{l}</div>
                        <div style={{ fontSize:12, color:"#94a3b8", whiteSpace:"pre-wrap" }}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline project panel - shows when company is selected */}
                {selectedCompany?.id===c.id && (() => {
                  const cp = projects.filter(p =>
                    p.company_id === c.id ||
                    (p.client||"").trim().toLowerCase() === c.name.trim().toLowerCase()
                  );
                  return (
                    <div style={{ marginTop:12, borderTop:"1px solid #1a2744", paddingTop:12 }} onClick={e=>e.stopPropagation()}>
                      <div style={{ fontSize:12, fontWeight:700, color:"#64748b", marginBottom:8 }}>📊 Proyek Terkait ({cp.length})</div>
                      {cp.length === 0 ? (
                        <div style={{ fontSize:12, color:"#334155" }}>Belum ada proyek untuk perusahaan ini</div>
                      ) : cp.map(p => {
                        const daysLeft = (() => { try { return Math.ceil((new Date(p.freeSupport?.endDate)-new Date())/(1000*60*60*24)); } catch { return null; } })();
                        const stages = p.implementation?.stages||[];
                        const done = stages.filter(s=>s.status==="done").length;
                        const pct = stages.length > 0 ? Math.round(done/stages.length*100) : 0;
                        const trainLeft = (p.trainingHours?.total||0)-(p.trainingHours?.used||0);
                        return (
                          <div key={p.id} onClick={()=>onSelectProject&&onSelectProject(p.id)}
                            style={{ background:"#060d1a", border:"1px solid #1a2744", borderRadius:10, padding:12, marginBottom:8, cursor:onSelectProject?"pointer":"default" }}
                            onMouseEnter={e=>{ if(onSelectProject) e.currentTarget.style.borderColor="#38bdf8"; }}
                            onMouseLeave={e=>e.currentTarget.style.borderColor="#1a2744"}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9" }}>{p.name}</div>
                              {daysLeft !== null && <span style={{ padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700, background:daysLeft<=0?"#450a0a":daysLeft<=30?"#451a03":"#052e16", color:daysLeft<=0?"#ef4444":daysLeft<=30?"#f59e0b":"#10b981" }}>{daysLeft<=0?"Expired":`${daysLeft}h support`}</span>}
                            </div>
                            <div style={{ marginBottom:6 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#475569", marginBottom:3 }}><span>Implementasi</span><span style={{ color:pct===100?"#10b981":"#f59e0b", fontWeight:600 }}>{pct}%</span></div>
                              <div style={{ height:4, background:"#1a2744", borderRadius:999 }}><div style={{ height:"100%", borderRadius:999, background:pct===100?"#10b981":"#f59e0b", width:`${pct}%` }} /></div>
                            </div>
                            <div style={{ display:"flex", gap:12, fontSize:11, color:"#475569" }}>
                              <span>🔧 <span style={{ color:"#38bdf8", fontWeight:600 }}>{trainLeft}</span> jam sisa</span>
                              {p.server?.active && <span style={{ color:"#10b981" }}>🖥 Server aktif</span>}
                              {onSelectProject && <span style={{ color:"#334155", marginLeft:"auto" }}>Klik buka →</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign:"center", color:"#334155", padding:30 }}>Tidak ada perusahaan yang cocok</div>}
        </div>
      )}
    </div>
    {linkTarget && (
      <LinkProjectModal
        company={linkTarget}
        projects={projects}
        onClose={()=>setLinkTarget(null)}
        onLinked={(projectId, companyId)=>{
          // Update local projects cache
          if (onSelectProject) {
            // trigger refresh by toggling selectedCompany
            setSelectedCompany(prev=>prev?{...prev}:prev);
          }
        }}
      />
    )}
    {newCompanyData && (
      <NewClientProjectModal
        company={newCompanyData}
        onClose={() => setNewCompanyData(null)}
        onCreated={() => { setNewCompanyData(null); notify(setMsg, "✅ Proyek klien berhasil dibuat!"); }}
      />
    )}
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
// ─── UNLINKED PROJECTS PANEL ─────────────────────────────────────────────────
function UnlinkedProjectsPanel({ projects, companies, onLink }) {
  const SUPA_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
  const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | linked | unlinked
  const [editingId, setEditingId] = useState(null);
  const [compSearch, setCompSearch] = useState({});
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState(null);

  const linkedCount = projects.filter(p=>p.company_id).length;
  const unlinkedCount = projects.filter(p=>!p.company_id).length;

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client||"").toLowerCase().includes(search.toLowerCase());
    if (filter === "linked") return matchSearch && p.company_id;
    if (filter === "unlinked") return matchSearch && !p.company_id;
    return matchSearch;
  });

  const getCompany = (companyId) => companies.find(c=>c.id===companyId);

  const getSuggestion = (p) => !p.company_id &&
    companies.find(c =>
      c.name.trim().toLowerCase() === (p.client||"").trim().toLowerCase() &&
      !projects.find(pr=>pr.company_id===c.id)
    );

  const handleSaveLink = async (projectId, companyId) => {
    // companyId === null means unlink
    if (companyId !== null) {
      const alreadyLinked = projects.find(p=>p.company_id===companyId && p.id!==projectId);
      if (alreadyLinked) {
        setMsg({ text:`❌ Perusahaan sudah tertaut ke "${alreadyLinked.name}"`, type:"error" });
        setTimeout(()=>setMsg(null),4000); return;
      }
    }
    setSaving(projectId);
    try {
      const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPA_KEY;
      const res = await fetch(`${SUPA_URL}/rest/v1/projects?id=eq.${projectId}`, {
        method:"PATCH",
        headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":`Bearer ${token}`,"Prefer":"return=minimal"},
        body: JSON.stringify({ company_id: companyId }),
      });
      if (!res.ok) throw new Error(await res.text());
      onLink(projectId, companyId);
      setEditingId(null);
      setMsg({ text: companyId ? "✅ Tautan berhasil diubah!" : "✅ Tautan berhasil dilepas!", type:"success" });
      setTimeout(()=>setMsg(null),2500);
    } catch(e) { setMsg({ text:"Gagal: "+e.message, type:"error" }); }
    setSaving(null);
  };

  return (
    <div style={{ marginTop:24 }}>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {[[projects.length,"Total Proyek","#38bdf8"],[linkedCount,"Sudah Tertaut","#10b981"],[unlinkedCount,"Belum Tertaut",unlinkedCount>0?"#f59e0b":"#10b981"]].map(([v,l,c])=>(
          <div key={l} style={{ background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:"12px 14px" }}>
            <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {msg && <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:12, fontSize:13, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>{msg.text}</div>}

      {/* Filter + Search */}
      <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6 }}>
          {[["all","Semua"],["linked","Tertaut"],["unlinked","Belum Tertaut"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${filter===v?"#38bdf8":"#1e293b"}`, background:filter===v?"#0c2a3f":"transparent", color:filter===v?"#38bdf8":"#475569", cursor:"pointer", fontSize:12, fontWeight:filter===v?700:400 }}>{l}</button>
          ))}
        </div>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#475569" }}>🔍</span>
          <input style={{ width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"7px 10px 7px 30px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
            placeholder="Cari nama proyek atau klien..." value={search} onChange={e=>setSearch(e.target.value)} />
        </div>
      </div>

      {/* Project list */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:30, color:"#334155" }}>Tidak ada proyek yang cocok</div>
        ) : filtered.map(p => {
          const linkedCompany = getCompany(p.company_id);
          const suggestion = getSuggestion(p);
          const isEditing = editingId === p.id;
          const availableComps = companies.filter(c =>
            c.name.toLowerCase().includes((compSearch[p.id]||"").toLowerCase()) &&
            (!projects.find(pr=>pr.company_id===c.id) || c.id===p.company_id)
          );

          return (
            <div key={p.id} style={{ background:"#0c1628", border:`1px solid ${isEditing?"#38bdf8":linkedCompany?"#10b98133":"#f59e0b33"}`, borderRadius:12, padding:14, transition:"border-color 0.15s" }}>
              {/* Header row */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:"#f1f5f9" }}>{p.name}</div>
                  <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>Klien di proyek: <span style={{ color:"#94a3b8" }}>{p.client||"-"}</span></div>

                  {/* Current link status */}
                  {linkedCompany ? (
                    <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:6 }}>
                      <span style={{ fontSize:11, color:"#10b981" }}>🔗 Tertaut ke:</span>
                      <span style={{ fontSize:11, fontWeight:700, color:"#10b981", padding:"2px 8px", borderRadius:999, background:"#052e16" }}>{linkedCompany.name}</span>
                    </div>
                  ) : (
                    <div style={{ marginTop:6 }}>
                      <span style={{ fontSize:11, color:"#f59e0b" }}>⚠️ Belum tertaut ke perusahaan</span>
                      {suggestion && !isEditing && (
                        <button onClick={()=>handleSaveLink(p.id, suggestion.id)} disabled={saving===p.id}
                          style={{ marginLeft:8, padding:"2px 10px", borderRadius:6, border:"none", background:"#451a03", color:"#f59e0b", cursor:"pointer", fontSize:11, fontWeight:600 }}>
                          💡 Tautkan ke {suggestion.name}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                  {linkedCompany && !isEditing && (
                    <button onClick={()=>handleSaveLink(p.id, null)} disabled={saving===p.id}
                      style={{ padding:"5px 10px", borderRadius:8, border:"1px solid #7f1d1d", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:11 }}
                      title="Lepas tautan">✕ Lepas</button>
                  )}
                  <button onClick={()=>setEditingId(isEditing?null:p.id)}
                    style={{ padding:"5px 12px", borderRadius:8, border:`1px solid ${isEditing?"#ef4444":"#1d4ed8"}`, background:"transparent", color:isEditing?"#ef4444":"#38bdf8", cursor:"pointer", fontSize:11, fontWeight:600 }}>
                    {isEditing?"✕ Batal":linkedCompany?"✏️ Ganti":"🔗 Tautkan"}
                  </button>
                </div>
              </div>

              {/* Company picker when editing */}
              {isEditing && (
                <div style={{ marginTop:12, borderTop:"1px solid #1a2744", paddingTop:12 }}>
                  <div style={{ fontSize:11, color:"#64748b", marginBottom:8 }}>
                    {linkedCompany ? "Pilih perusahaan pengganti:" : "Pilih perusahaan:"}
                  </div>
                  <div style={{ position:"relative", marginBottom:8 }}>
                    <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", fontSize:12, color:"#475569" }}>🔍</span>
                    <input autoFocus style={{ width:"100%", background:"#060d1a", border:"1px solid #1e293b", borderRadius:8, padding:"7px 10px 7px 30px", color:"#e2e8f0", fontSize:12, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
                      placeholder="Cari perusahaan..." value={compSearch[p.id]||""}
                      onChange={e=>setCompSearch(prev=>({...prev,[p.id]:e.target.value}))} />
                  </div>
                  <div style={{ maxHeight:180, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
                    {availableComps.slice(0,20).map(c=>(
                      <button key={c.id} onClick={()=>handleSaveLink(p.id, c.id)} disabled={saving===p.id}
                        style={{ padding:"8px 12px", borderRadius:8, border:`1px solid ${c.id===p.company_id?"#38bdf8":"#1a2744"}`, background:c.id===p.company_id?"#0c2a3f":"#0a1525", color:"#e2e8f0", cursor:"pointer", textAlign:"left", fontSize:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <span style={{ fontWeight:600 }}>{c.name}</span>
                          <span style={{ fontSize:10, color:c.status==="klien"?"#10b981":"#f59e0b", marginLeft:8 }}>{c.status}</span>
                          {c.id===p.company_id && <span style={{ fontSize:10, color:"#38bdf8", marginLeft:6 }}>(saat ini)</span>}
                        </div>
                        <span style={{ color:"#475569", fontSize:12 }}>{saving===p.id?"...":"→"}</span>
                      </button>
                    ))}
                    {availableComps.length === 0 && <div style={{ color:"#334155", fontSize:12, padding:8 }}>Tidak ditemukan atau semua sudah tertaut</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function MasterDataPage({ onClose, isAdmin, projects = [], onSelectProject }) {
  const [tab, setTab] = useState("perusahaan");
  const [allCompanies, setAllCompanies] = useState([]);
  const SUPA_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
  const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPA_KEY;
    fetch(`${SUPA_URL}/rest/v1/companies?order=name.asc&select=id,name,status`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` }
    }).then(r => r.json()).then(setAllCompanies).catch(() => {});
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, background:"#060d1a", zIndex:2000, overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0c1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:3px}`}</style>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom:24 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, marginBottom:8, padding:0 }}>← Kembali ke Dashboard</button>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#f1f5f9", margin:0 }}>🗂 Data Master</h1>
          <div style={{ fontSize:13, color:"#475569", marginTop:4 }}>Kelola data tim dan perusahaan yang digunakan di seluruh aplikasi</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:24 }}>
          {[["perusahaan","🏢 Data Perusahaan"],["tim","👥 Data Tim"],["tautan","🔗 Tautan Proyek"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{
              padding:"9px 20px", borderRadius:10, border:"none", cursor:"pointer", fontSize:13, fontWeight:700,
              background: tab===v ? "#1d4ed8" : "#0c1628",
              color: tab===v ? "#fff" : "#475569",
              transition:"all 0.2s",
            }}>{l}</button>
          ))}
        </div>

        {/* Content */}
        {tab === "perusahaan" && <CompanySection isAdmin={isAdmin} projects={projects} onSelectProject={onSelectProject} />}
        {tab === "tim" && <TeamSection isAdmin={isAdmin} />}
        {tab === "tautan" && (
          <UnlinkedProjectsPanel
            projects={projects}
            companies={allCompanies}
            onLink={(projectId, companyId) => { window.location.reload(); }}
          />
        )}
      </div>
    </div>
  );
}
