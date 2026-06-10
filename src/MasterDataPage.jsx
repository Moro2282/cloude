import { useState, useEffect } from "react";

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
    try {
      if (editId) await dbPatch("team_members", editId, { name:form.name, position:form.position });
      else await dbPost("team_members", { name:form.name, position:form.position });
      notify(setMsg, editId ? "Berhasil diupdate!" : "Anggota tim ditambahkan!");
      setForm({ name:"", position:"" }); setEditId(null); load();
    } catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus anggota tim ini?")) return;
    try { await dbDelete("team_members", id); load(); notify(setMsg,"Berhasil dihapus!"); }
    catch(e) { notify(setMsg, e.message, "error"); }
  };

  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || (m.position||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <>
    <div>
      {msg && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:12, fontSize:12, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>{msg.text}</div>}

      {isAdmin && (
        <div style={{ ...MINI, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:10 }}>{editId ? "✏️ Edit Anggota Tim" : "➕ Tambah Anggota Tim"}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
            <div><label style={{ fontSize:11, color:"#64748b" }}>Nama *</label><input style={INP} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nama lengkap" /></div>
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
// ─── NEW CLIENT PROJECT MODAL ────────────────────────────────────────────────
function NewClientProjectModal({ company, onClose, onCreated }) {
  const SUPA_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
  const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

  const today = new Date().toISOString().split("T")[0];
  const oneYearLater = new Date(new Date().setFullYear(new Date().getFullYear()+1)).toISOString().split("T")[0];

  const [form, setForm] = useState({
    name: company.name,
    client: company.name,
    clientEmail: company.pic_phone || "",
    startDate: today,
    trainTotal: 40,
    invTotal: 10,
    supportEnd: oneYearLater,
    serverActive: false,
    serverStart: today,
    serverEnd: oneYearLater,
    serverNotes: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };
  const MINI = { background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:14 };

  const handleCreate = async () => {
    if (!form.name.trim()) { setErr("Nama proyek wajib diisi"); return; }
    setSaving(true);
    try {
      const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPA_KEY;
      const newProject = {
        name: form.name.trim(),
        client: form.client,
        clientEmail: form.clientEmail,
        startDate: form.startDate,
        trainingHours: { total: parseInt(form.trainTotal)||40, used: 0 },
        invoiceDesigns: { total: parseInt(form.invTotal)||10, used: 0 },
        freeSupport: { startDate: form.startDate, endDate: form.supportEnd, renewals: 0 },
        server: {
          active: form.serverActive,
          startDate: form.serverActive ? form.serverStart : "",
          endDate: form.serverActive ? form.serverEnd : "",
          notes: form.serverNotes,
        },
        implementation: { stages: [
          {id:1,name:"Analisis Kebutuhan",status:"pending",notes:"",date:""},
          {id:2,name:"Setup & Instalasi",status:"pending",notes:"",date:""},
          {id:3,name:"Training Tim",status:"pending",notes:"",date:""},
          {id:4,name:"Uji Coba (UAT)",status:"pending",notes:"",date:""},
          {id:5,name:"Go Live",status:"pending",notes:"",date:""},
          {id:6,name:"Post-Implementation Review",status:"pending",notes:"",date:""},
        ]},
      };
      const res = await fetch(`${SUPA_URL}/rest/v1/projects`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":`Bearer ${token}`, "Prefer":"return=representation" },
        body: JSON.stringify(newProject),
      });
      if (!res.ok) throw new Error(await res.text());
      onCreated();
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #10b981", borderRadius:16, padding:28, maxWidth:600, width:"100%", maxHeight:"90vh", overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:"#f1f5f9" }}>🎉 Perusahaan Baru Menjadi Klien!</div>
            <div style={{ fontSize:12, color:"#10b981", marginTop:4 }}>Lengkapi info proyek untuk <strong>{company.name}</strong></div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {err && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:14, fontSize:12, background:"#1c0a0a", color:"#ef4444" }}>⚠️ {err}</div>}

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Nama Proyek */}
          <div style={MINI}>
            <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:10 }}>📁 Info Proyek</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ fontSize:11, color:"#64748b" }}>Nama Proyek *</label>
                <input style={INP} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Nama Klien</label>
                <input style={INP} value={form.client} onChange={e=>setForm(f=>({...f,client:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Email / No. HP</label>
                <input style={INP} value={form.clientEmail} onChange={e=>setForm(f=>({...f,clientEmail:e.target.value}))} placeholder={company.pic_phone||""} />
              </div>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Tanggal Mulai</label>
                <input type="date" style={INP} value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} />
              </div>
            </div>
          </div>

          {/* Jam Layanan */}
          <div style={MINI}>
            <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:10 }}>🔧 Layanan Teknis & Faktur</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Total Jam Layanan</label>
                <input type="number" style={INP} value={form.trainTotal} onChange={e=>setForm(f=>({...f,trainTotal:e.target.value}))} min="0" />
              </div>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Total Desain Faktur</label>
                <input type="number" style={INP} value={form.invTotal} onChange={e=>setForm(f=>({...f,invTotal:e.target.value}))} min="0" />
              </div>
            </div>
          </div>

          {/* Free Support */}
          <div style={MINI}>
            <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:10 }}>🛡 Free Support</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Tanggal Mulai</label>
                <input type="date" style={INP} value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, color:"#64748b" }}>Tanggal Berakhir</label>
                <input type="date" style={INP} value={form.supportEnd} onChange={e=>setForm(f=>({...f,supportEnd:e.target.value}))} />
              </div>
            </div>
            <div style={{ fontSize:11, color:"#475569", marginTop:8 }}>
              Durasi: {Math.round((new Date(form.supportEnd)-new Date(form.startDate))/(1000*60*60*24*30))} bulan
            </div>
          </div>

          {/* Server */}
          <div style={MINI}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: form.serverActive ? 10 : 0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#64748b" }}>🖥 Server / Hosting</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color: form.serverActive?"#38bdf8":"#475569" }}>{form.serverActive?"Aktif":"Tidak Aktif"}</span>
                <div onClick={()=>setForm(f=>({...f,serverActive:!f.serverActive}))} style={{ width:40,height:22,borderRadius:999,cursor:"pointer",background:form.serverActive?"#38bdf8":"#1e293b",position:"relative",transition:"background 0.2s" }}>
                  <div style={{ position:"absolute",top:2,left:form.serverActive?20:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }} />
                </div>
              </div>
            </div>
            {form.serverActive && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:10 }}>
                <div>
                  <label style={{ fontSize:11, color:"#64748b" }}>Mulai Langganan</label>
                  <input type="date" style={INP} value={form.serverStart} onChange={e=>setForm(f=>({...f,serverStart:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:"#64748b" }}>Berakhir</label>
                  <input type="date" style={INP} value={form.serverEnd} onChange={e=>setForm(f=>({...f,serverEnd:e.target.value}))} />
                </div>
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={{ fontSize:11, color:"#64748b" }}>Catatan Server</label>
                  <input style={INP} value={form.serverNotes} onChange={e=>setForm(f=>({...f,serverNotes:e.target.value}))} placeholder="Provider, spesifikasi, dll" />
                </div>
              </div>
            )}
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleCreate} disabled={saving} style={{ flex:1, padding:"11px", borderRadius:8, border:"none", background:saving?"#1e293b":"#059669", color:saving?"#475569":"#fff", cursor:saving?"not-allowed":"pointer", fontWeight:700, fontSize:14 }}>
              {saving?"Menyimpan...":"🚀 Buat Proyek Klien"}
            </button>
            <button onClick={onClose} style={{ padding:"11px 16px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>Nanti</button>
          </div>
          <div style={{ fontSize:11, color:"#334155", textAlign:"center" }}>Klik "Nanti" untuk buat proyek secara manual dari Dashboard</div>
        </div>
      </div>
    </div>
  );
}

function CompanySection({ isAdmin }) {
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
  const [newCompanyData, setNewCompanyData] = useState(null); // triggers project form after save

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
      setEditId(null); setShowPicPicker(false); load();
    } catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus perusahaan ini?")) return;
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

      {isAdmin && (
        <div style={{ ...MINI, marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:10 }}>{editId ? "✏️ Edit Perusahaan" : "➕ Tambah Perusahaan"}</div>
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
            <button onClick={handleSave} style={BTN}>{editId ? "💾 Update" : "+ Tambah"}</button>
            {editId && <button onClick={()=>{setEditId(null);setForm({name:"",pic_name:"",pic_phone:"",address:"",status:"prospek",notes:""});}} style={{ ...BTN, background:"transparent", border:"1px solid #334155", color:"#64748b" }}>Batal</button>}
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
              <div key={c.id} style={{ ...MINI, borderLeft:`3px solid ${statusColor}`, cursor:"pointer" }} onClick={()=>setExpandId(isExpanded ? null : c.id)}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{c.name}</span>
                      <span style={{ padding:"2px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:statusBg, color:statusColor }}>{c.status === "klien" ? "✅ Klien" : "🎯 Prospek"}</span>
                    </div>
                    {c.pic_name && <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>👤 {c.pic_name} {c.pic_phone && `· 📞 ${c.pic_phone}`}</div>}
                    {c.address && !isExpanded && <div style={{ fontSize:11, color:"#334155", marginTop:2 }}>📍 {c.address.slice(0,50)}{c.address.length>50?"...":""}</div>}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center" }}>
                    {isAdmin && <>
                      <button onClick={e=>{e.stopPropagation();handleEdit(c);}} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #1d4ed8", background:"transparent", color:"#38bdf8", cursor:"pointer", fontSize:11 }}>✏️</button>
                      <button onClick={e=>{e.stopPropagation();handleDelete(c.id);}} style={{ padding:"4px 8px", borderRadius:6, border:"1px solid #7f1d1d", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:11 }}>🗑</button>
                    </>}
                    <span style={{ color:"#334155", fontSize:12 }}>{isExpanded ? "▲" : "▼"}</span>
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
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ textAlign:"center", color:"#334155", padding:30 }}>Tidak ada perusahaan yang cocok</div>}
        </div>
      )}
    </div>
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
export default function MasterDataPage({ onClose, isAdmin }) {
  const [tab, setTab] = useState("perusahaan");

  return (
    <div style={{ position:"fixed", inset:0, background:"#060d1a", zIndex:2000, overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0c1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:3px}`}</style>
      <div style={{ maxWidth:1000, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, marginBottom:8, padding:0, display:"flex", alignItems:"center", gap:6 }}>← Kembali ke Dashboard</button>
          <h1 style={{ fontSize:28, fontWeight:900, color:"#f1f5f9", margin:0 }}>🗂 Data Master</h1>
          <div style={{ fontSize:13, color:"#475569", marginTop:6 }}>Kelola data tim dan perusahaan yang digunakan di seluruh aplikasi</div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:8, marginBottom:24 }}>
          {[["perusahaan","🏢 Data Perusahaan"],["tim","👥 Data Tim"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{
              padding:"10px 24px", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer",
              border:`1px solid ${tab===v?"#38bdf8":"#1e293b"}`,
              background:tab===v?"#0c4a6e":"#0a1525",
              color:tab===v?"#38bdf8":"#475569", transition:"all 0.15s",
            }}>{l}</button>
          ))}
        </div>

        {/* Content */}
        {tab === "perusahaan" && <CompanySection isAdmin={isAdmin} />}
        {tab === "tim" && <TeamSection isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
