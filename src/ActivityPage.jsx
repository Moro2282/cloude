import { useState, useEffect } from "react";
import { logActivity } from "./logger";
import NewClientProjectModal from "./NewClientProjectModal";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

function getToken() {
  try { return JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY; }
  catch { return SUPABASE_KEY; }
}
function hdrs(extra = {}) {
  return { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${getToken()}`, "Prefer": "return=representation", ...extra };
}
async function dbGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers: hdrs() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbPost(table, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: "POST", headers: hdrs(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbPatch(table, id, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: "PATCH", headers: hdrs(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function dbDelete(table, id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers: hdrs() });
  if (!res.ok) throw new Error(await res.text());
}

const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };
const MINI = { background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:14 };
const BTN = { padding:"9px 20px", borderRadius:8, border:"none", background:"#1d4ed8", color:"#fff", cursor:"pointer", fontWeight:600, fontSize:13 };

const ACT_CONFIG = {
  presentasi: { color:"#a78bfa", bg:"#1e1040", icon:"📊", label:"Presentasi" },
  meeting:    { color:"#38bdf8", bg:"#0c2a3f", icon:"🤝", label:"Meeting" },
  onsite:     { color:"#10b981", bg:"#052e16", icon:"🔧", label:"Onsite" },
  training:   { color:"#f59e0b", bg:"#451a03", icon:"📚", label:"Training" },
};
const STATUS_CONFIG = {
  prospek: { color:"#f59e0b", bg:"#451a03", label:"Prospek" },
  klien:   { color:"#10b981", bg:"#052e16", label:"Klien" },
};

function Badge({ type, config }) {
  const c = config[type] || {};
  return <span style={{ padding:"2px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:c.bg, color:c.color }}>{c.icon ? `${c.icon} ${c.label}` : c.label}</span>;
}

function fmtDate(d) {
  if (!d) return "-";
  const [y,m,day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}

function calcDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h} jam ${m} menit` : `${h} jam`) : `${m} menit`;
}

function notify(setter, text, type="success") {
  setter({ text, type });
  setTimeout(() => setter(null), 3000);
}

// ─── MODAL WRAPPER ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:28, maxWidth:wide?860:520, width:"100%", maxHeight:"90vh", overflowY:"auto", fontFamily:"inherit" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:17, fontWeight:700, color:"#f1f5f9" }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── MASTER TIM ───────────────────────────────────────────────────────────────
function TeamMasterModal({ onClose }) {
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ name:"", position:"" });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => { setLoading(true); const d = await dbGet("team_members","?order=name.asc"); setMembers(d); setLoading(false); };

  const handleSave = async () => {
    if (!form.name.trim()) { notify(setMsg,"Nama wajib diisi","error"); return; }
    try {
      if (editId) { await dbPatch("team_members", editId, { name:form.name, position:form.position }); }
      else { await dbPost("team_members", { name:form.name, position:form.position }); }
      notify(setMsg, editId ? "Berhasil diupdate!" : "Anggota tim ditambahkan!");
      setForm({ name:"", position:"" }); setEditId(null); load();
    } catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus anggota tim ini?")) return;
    try { await dbDelete("team_members", id); load(); notify(setMsg,"Berhasil dihapus!"); }
    catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleEdit = (m) => { setEditId(m.id); setForm({ name:m.name, position:m.position||"" }); };

  return (
    <Modal title="👥 Master Data Tim" onClose={onClose}>
      {msg && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:14, fontSize:12, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981" }}>{msg.text}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
        <div><label style={{ fontSize:11, color:"#64748b" }}>Nama *</label><input style={INP} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nama anggota tim" /></div>
        <div><label style={{ fontSize:11, color:"#64748b" }}>Posisi / Jabatan</label><input style={INP} value={form.position} onChange={e=>setForm(f=>({...f,position:e.target.value}))} placeholder="Sales, Teknisi, dll" /></div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <button onClick={handleSave} style={BTN}>{editId?"💾 Update":"+ Tambah"}</button>
        {editId && <button onClick={()=>{setEditId(null);setForm({name:"",position:""}); }} style={{ ...BTN, background:"transparent", border:"1px solid #334155", color:"#64748b" }}>Batal</button>}
      </div>
      {loading ? <div style={{ color:"#475569", textAlign:"center", padding:20 }}>Memuat...</div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {members.map(m => (
            <div key={m.id} style={{ ...MINI, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:14, flexShrink:0 }}>{m.name.charAt(0).toUpperCase()}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{m.name}</div>
                <div style={{ fontSize:11, color:"#475569" }}>{m.position || "—"}</div>
              </div>
              <button onClick={()=>handleEdit(m)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #1d4ed8", background:"transparent", color:"#38bdf8", cursor:"pointer", fontSize:11 }}>✏️</button>
              <button onClick={()=>handleDelete(m.id)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #7f1d1d", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:11 }}>🗑</button>
            </div>
          ))}
          {members.length === 0 && <div style={{ textAlign:"center", color:"#334155", padding:20 }}>Belum ada anggota tim</div>}
        </div>
      )}
    </Modal>
  );
}

// ─── MASTER PERUSAHAAN ────────────────────────────────────────────────────────
function CompanyMasterModal({ onClose }) {
  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ name:"", pic_name:"", pic_phone:"", address:"", status:"prospek", notes:"" });
  const [editId, setEditId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { load(); }, []);
  const load = async () => { setLoading(true); const d = await dbGet("companies","?order=name.asc"); setCompanies(d); setLoading(false); };

  const handleSave = async () => {
    if (!form.name.trim()) { notify(setMsg,"Nama perusahaan wajib diisi","error"); return; }
    try {
      if (editId) { await dbPatch("companies", editId, form); }
      else { await dbPost("companies", form); }
      notify(setMsg, editId ? "Perusahaan diupdate!" : "Perusahaan ditambahkan!");
      setForm({ name:"", pic_name:"", pic_phone:"", address:"", status:"prospek", notes:"" });
      setEditId(null); load();
    } catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus perusahaan ini?")) return;
    try { await dbDelete("companies", id); load(); notify(setMsg,"Berhasil dihapus!"); }
    catch(e) { notify(setMsg, e.message, "error"); }
  };

  const handleEdit = (c) => { setEditId(c.id); setForm({ name:c.name, pic_name:c.pic_name||"", pic_phone:c.pic_phone||"", address:c.address||"", status:c.status||"prospek", notes:c.notes||"" }); };

  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.pic_name||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <Modal title="🏢 Master Data Perusahaan" onClose={onClose} wide>
      {msg && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:14, fontSize:12, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981" }}>{msg.text}</div>}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
        <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, color:"#64748b" }}>Nama Perusahaan *</label><input style={INP} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="PT / CV / Nama Usaha" /></div>
        <div><label style={{ fontSize:11, color:"#64748b" }}>Nama PIC</label><input style={INP} value={form.pic_name} onChange={e=>setForm(f=>({...f,pic_name:e.target.value}))} placeholder="Nama kontak" /></div>
        <div><label style={{ fontSize:11, color:"#64748b" }}>No. HP PIC</label><input style={INP} value={form.pic_phone} onChange={e=>setForm(f=>({...f,pic_phone:e.target.value}))} placeholder="08xx..." /></div>
        <div>
          <label style={{ fontSize:11, color:"#64748b" }}>Status</label>
          <div style={{ display:"flex", gap:6, marginTop:4 }}>
            {[["prospek","Prospek","#f59e0b"],["klien","Klien","#10b981"]].map(([v,l,c])=>(
              <button key={v} onClick={()=>setForm(f=>({...f,status:v}))} style={{ flex:1, padding:"7px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.status===v?c:"#1e293b"}`, background:form.status===v?STATUS_CONFIG[v].bg:"transparent", color:form.status===v?c:"#475569" }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, color:"#64748b" }}>Alamat</label><input style={INP} value={form.address} onChange={e=>setForm(f=>({...f,address:e.target.value}))} placeholder="Alamat perusahaan" /></div>
        <div style={{ gridColumn:"1/-1" }}><label style={{ fontSize:11, color:"#64748b" }}>Catatan</label><textarea style={{ ...INP, resize:"vertical" }} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Info tambahan..." /></div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        <button onClick={handleSave} style={BTN}>{editId?"💾 Update":"+ Tambah"}</button>
        {editId && <button onClick={()=>{setEditId(null);setForm({name:"",pic_name:"",pic_phone:"",address:"",status:"prospek",notes:""}); }} style={{ ...BTN, background:"transparent", border:"1px solid #334155", color:"#64748b" }}>Batal</button>}
      </div>
      <div style={{ position:"relative", marginBottom:12 }}>
        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569" }}>🔍</span>
        <input style={{ ...INP, marginTop:0, paddingLeft:32 }} placeholder="Cari perusahaan..." value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      {loading ? <div style={{ color:"#475569", textAlign:"center", padding:20 }}>Memuat...</div> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:320, overflowY:"auto" }}>
          {filtered.map(c => (
            <div key={c.id} style={{ ...MINI, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:"#e2e8f0" }}>{c.name}</span>
                  <Badge type={c.status} config={STATUS_CONFIG} />
                </div>
                <div style={{ fontSize:11, color:"#475569" }}>{c.pic_name && `👤 ${c.pic_name}`} {c.pic_phone && `· 📞 ${c.pic_phone}`}</div>
                {c.address && <div style={{ fontSize:11, color:"#334155" }}>📍 {c.address}</div>}
              </div>
              <button onClick={()=>handleEdit(c)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #1d4ed8", background:"transparent", color:"#38bdf8", cursor:"pointer", fontSize:11 }}>✏️</button>
              <button onClick={()=>handleDelete(c.id)} style={{ padding:"4px 10px", borderRadius:6, border:"1px solid #7f1d1d", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:11 }}>🗑</button>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ textAlign:"center", color:"#334155", padding:20 }}>Tidak ada perusahaan</div>}
        </div>
      )}
    </Modal>
  );
}

// ─── SEARCH PICKERS ───────────────────────────────────────────────────────────

function MemberPicker({ members, selectedIds, selectedNames, onToggle, onClear, onAddNew }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Only show unselected members, and only when there's a search query
  const filtered = search.trim()
    ? members.filter(m =>
        !selectedIds.includes(m.id) &&
        (m.name.toLowerCase().includes(search.toLowerCase()) ||
         (m.position||"").toLowerCase().includes(search.toLowerCase()))
      )
    : [];

  return (
    <div style={MINI}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#64748b" }}>👥 Anggota Tim * <span style={{ color:"#334155", fontWeight:400 }}>(bisa lebih dari 1)</span></div>
        {selectedNames.length > 0 && <button onClick={onClear} style={{ fontSize:10, padding:"2px 8px", borderRadius:6, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>✕ Hapus Semua</button>}
      </div>

      {/* Selected chips */}
      {selectedNames.length > 0 && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {selectedNames.map((name, i) => (
            <span key={name} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:999, fontSize:11, fontWeight:600, background:"#0c2a3f", color:"#38bdf8", border:"1px solid #1d4ed833" }}>
              ✓ {name}
              <span onClick={()=>onToggle({id:selectedIds[i],name})} style={{ cursor:"pointer", marginLeft:2, opacity:0.7, fontSize:12 }}>✕</span>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:12 }}>🔍</span>
        <input style={{ ...INP, marginTop:0, paddingLeft:30 }}
          placeholder={selectedNames.length > 0 ? "Tambah anggota lain..." : "Ketik nama untuk mencari..."}
          value={search}
          onChange={e=>{ setSearch(e.target.value); setOpen(true); }}
          onFocus={()=>{ if(search.trim()) setOpen(true); }}
        />
      </div>

      {/* Dropdown - only when there is search text */}
      {open && search.trim() && (
        <>
          <div style={{ position:"fixed", inset:0, zIndex:98 }} onClick={()=>{ setOpen(false); setSearch(""); }} />
          <div style={{ position:"relative", zIndex:99 }}>
            <div style={{ background:"#060d1a", border:"1px solid #1e293b", borderRadius:10, marginTop:4, maxHeight:220, overflowY:"auto" }}>
              {filtered.length > 0 ? filtered.map(m => (
                <div key={m.id} onMouseDown={()=>{ onToggle(m); setSearch(""); setOpen(false); }}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", cursor:"pointer", borderBottom:"1px solid #0f172a" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#0a1525"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontWeight:700, fontSize:12, flexShrink:0 }}>
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{m.name}</div>
                    {m.position && <div style={{ fontSize:11, color:"#475569" }}>{m.position}</div>}
                  </div>
                </div>
              )) : (
                <div style={{ padding:"12px 14px" }}>
                  <div style={{ fontSize:12, color:"#475569", marginBottom:8 }}>"{search}" tidak ditemukan di Master Tim</div>
                  <button onMouseDown={()=>{ setOpen(false); setSearch(""); onAddNew(); }}
                    style={{ fontSize:12, padding:"6px 14px", borderRadius:8, border:"1px solid #1d4ed8", background:"transparent", color:"#38bdf8", cursor:"pointer", fontWeight:600 }}>
                    + Tambah anggota tim baru
                  </button>
                </div>
              )}
              {filtered.length > 0 && (
                <div style={{ padding:"8px 14px", borderTop:"1px solid #0f172a" }}>
                  <button onMouseDown={()=>{ setOpen(false); setSearch(""); onAddNew(); }}
                    style={{ fontSize:11, padding:"5px 12px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>
                    + Tambah anggota tim baru
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


function CompanyPicker({ companies, selectedId, selectedName, selectedStatus, onSelect, onClear, onAddNew }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || (c.pic_name||"").toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={MINI}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ fontSize:12, fontWeight:600, color:"#64748b" }}>🏢 Perusahaan *</div>
        {selectedName && <button onClick={onClear} style={{ fontSize:10, padding:"2px 8px", borderRadius:6, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>✕ Hapus</button>}
      </div>

      {/* Selected */}
      {selectedName && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, padding:"8px 12px", background:"#060d1a", borderRadius:8, border:"1px solid #10b98133" }}>
          <span style={{ fontSize:12, color:"#10b981", fontWeight:600 }}>✓ {selectedName}</span>
          <Badge type={selectedStatus||"prospek"} config={STATUS_CONFIG} />
        </div>
      )}

      {/* Search input */}
      <div style={{ position:"relative" }}>
        <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:12 }}>🔍</span>
        <input style={{ ...INP, marginTop:0, paddingLeft:30 }} placeholder="Cari nama perusahaan atau PIC..." value={search}
          onChange={e=>{ setSearch(e.target.value); setOpen(true); }}
          onFocus={()=>setOpen(true)} />
      </div>

      {/* Dropdown */}
      {open && (
        <div style={{ background:"#060d1a", border:"1px solid #1e293b", borderRadius:10, marginTop:6, maxHeight:220, overflowY:"auto" }}>
          {filtered.length > 0 ? filtered.map(c => {
            const isSelected = selectedId === c.id;
            const sc = c.status === "klien" ? { color:"#10b981", bg:"#052e16" } : { color:"#f59e0b", bg:"#451a03" };
            return (
              <div key={c.id} onClick={()=>{ onSelect(c); setSearch(""); setOpen(false); }} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", cursor:"pointer", background:isSelected?"#052e16":"transparent", borderBottom:"1px solid #0f172a" }}
                onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background="#0a1525"; }}
                onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background=isSelected?"#052e16":"transparent"; }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{c.name}</span>
                    <span style={{ padding:"1px 8px", borderRadius:999, fontSize:10, fontWeight:700, background:sc.bg, color:sc.color }}>{c.status==="klien"?"Klien":"Prospek"}</span>
                  </div>
                  {c.pic_name && <div style={{ fontSize:11, color:"#475569" }}>👤 {c.pic_name}</div>}
                </div>
                {isSelected && <span style={{ color:"#10b981", fontSize:14 }}>✓</span>}
              </div>
            );
          }) : (
            <div style={{ padding:"12px 14px" }}>
              <div style={{ fontSize:12, color:"#475569", marginBottom:8 }}>"{search}" tidak ditemukan</div>
              <button onClick={()=>{ setOpen(false); onAddNew(); }} style={{ fontSize:12, padding:"6px 14px", borderRadius:8, border:"1px solid #10b981", background:"transparent", color:"#10b981", cursor:"pointer", fontWeight:600 }}>+ Tambah "{search}" ke Data Perusahaan</button>
            </div>
          )}
          {filtered.length > 0 && (
            <div style={{ padding:"8px 14px", borderTop:"1px solid #0f172a" }}>
              <button onClick={()=>{ setOpen(false); onAddNew(); }} style={{ fontSize:11, padding:"5px 12px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>+ Tambah perusahaan baru</button>
            </div>
          )}
        </div>
      )}
      {open && <div style={{ position:"fixed", inset:0, zIndex:-1 }} onClick={()=>setOpen(false)} />}
    </div>
  );
}

function QuickAddModal({ title, fields, onClose, onSave }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    const required = fields.find(([k,l]) => l.includes("*") && !form[k]?.trim());
    if (required) { setErr(`${required[1].replace(" *","")} wajib diisi`); return; }
    setSaving(true);
    try { await onSave(form); }
    catch(e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:24, maxWidth:380, width:"100%", fontFamily:"inherit" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, color:"#f1f5f9", marginBottom:16 }}>{title}</div>
        {err && <div style={{ fontSize:12, color:"#ef4444", marginBottom:10 }}>⚠️ {err}</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {fields.map(([k,label]) => (
            <div key={k}>
              <label style={{ fontSize:11, color:"#64748b" }}>{label}</label>
              <input style={INP} value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={label.replace(" *","")} />
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:"9px", borderRadius:8, border:"none", background:saving?"#1e293b":"#059669", color:saving?"#475569":"#fff", cursor:saving?"not-allowed":"pointer", fontWeight:600, fontSize:13 }}>{saving?"Menyimpan...":"Simpan & Pilih"}</button>
          <button onClick={onClose} style={{ padding:"9px 16px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:13 }}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── QUICK ADD COMPANY MODAL ─────────────────────────────────────────────────
function QuickAddCompanyModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name:"", pic_name:"", pic_phone:"", status:"prospek" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const INP_Q = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };

  const handleSave = async () => {
    if (!form.name.trim()) { setErr("Nama perusahaan wajib diisi"); return; }
    setSaving(true);
    try {
      await onSave({ name: form.name.trim(), pic_name: form.pic_name, pic_phone: form.pic_phone }, form.status);
    } catch(e) { setErr(e.message); setSaving(false); }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:24, maxWidth:400, width:"100%", fontFamily:"inherit" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, color:"#f1f5f9", marginBottom:16 }}>🏢 Tambah Perusahaan</div>
        {err && <div style={{ fontSize:12, color:"#ef4444", marginBottom:10 }}>⚠️ {err}</div>}
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:14 }}>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Nama Perusahaan *</label>
            <input style={INP_Q} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="PT / CV / Nama Usaha" autoFocus />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Nama PIC</label>
            <input style={INP_Q} value={form.pic_name} onChange={e=>setForm(f=>({...f,pic_name:e.target.value}))} placeholder="Nama kontak" />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>No. HP PIC</label>
            <input style={INP_Q} value={form.pic_phone} onChange={e=>setForm(f=>({...f,pic_phone:e.target.value}))} placeholder="08xx..." />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:6 }}>Status</label>
            <div style={{ display:"flex", gap:8 }}>
              {[["prospek","🎯 Prospek","#f59e0b","#451a03"],["klien","✅ Klien","#10b981","#052e16"]].map(([v,l,c,bg])=>(
                <button key={v} onClick={()=>setForm(f=>({...f,status:v}))} style={{ flex:1, padding:"8px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.status===v?c:"#1e293b"}`, background:form.status===v?bg:"transparent", color:form.status===v?c:"#475569" }}>
                  {l}
                </button>
              ))}
            </div>
            {form.status==="klien" && (
              <div style={{ marginTop:6, fontSize:11, color:"#10b981", padding:"6px 10px", background:"#052e16", borderRadius:6 }}>
                💡 Akan muncul form buat proyek setelah disimpan
              </div>
            )}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:"9px", borderRadius:8, border:"none", background:saving?"#1e293b":"#059669", color:saving?"#475569":"#fff", cursor:saving?"not-allowed":"pointer", fontWeight:600, fontSize:13 }}>
            {saving?"Menyimpan...":"Simpan & Pilih"}
          </button>
          <button onClick={onClose} style={{ padding:"9px 14px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>Batal</button>
        </div>
      </div>
    </div>
  );
}

// ─── FORM AKTIVITAS ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
export function ActivityFormModal({ activity, members, companies, currentUser, onClose, onSave }) {
  const isEdit = !!activity;
  const [form, setForm] = useState(activity ? {
    activity_date: activity.activity_date,
    activity_type: activity.activity_type,
    start_time: activity.start_time || "09:00",
    end_time: activity.end_time || "10:00",
    team_member_ids: activity.team_member_ids || (activity.team_member_id ? [activity.team_member_id] : []),
    team_member_names: activity.team_member_names || (activity.team_member_name ? [activity.team_member_name] : []),
    company_id: activity.company_id || "",
    company_name: activity.company_name,
    company_status: activity.company_status || "prospek",
    outcome: activity.outcome || "",
    notes: activity.notes || "",
    follow_up: activity.follow_up || "",
  } : {
    activity_date: new Date().toISOString().split("T")[0],
    activity_type: "meeting",
    start_time: "09:00",
    end_time: "10:00",
    team_member_ids: [],
    team_member_names: [],
    company_id: "",
    company_name: "",
    company_status: "prospek",
    outcome: "",
    notes: "",
    follow_up: "",
  });
  const [saving, setSaving] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [newClientData, setNewClientData] = useState(null);
  const [msg, setMsg] = useState(null);

  const toggleMember = (m) => {
    setForm(f => {
      const ids = f.team_member_ids || [];
      const names = f.team_member_names || [];
      if (ids.includes(m.id)) {
        return { ...f, team_member_ids: ids.filter(x => x !== m.id), team_member_names: names.filter(x => x !== m.name) };
      } else {
        return { ...f, team_member_ids: [...ids, m.id], team_member_names: [...names, m.name] };
      }
    });
  };
  const selectCompany = (c) => setForm(f => ({ ...f, company_id: c.id, company_name: c.name, company_status: c.status }));

  const handleSave = async () => {
    if (!form.activity_date || form.team_member_names.length === 0 || !form.company_name) {
      notify(setMsg, "Tanggal, minimal 1 anggota tim, dan perusahaan wajib diisi", "error"); return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        team_member_id: form.team_member_ids[0] || null,
        team_member_name: form.team_member_names.join(", "),
        team_member_ids: form.team_member_ids,
        team_member_names: form.team_member_names,
        created_by: currentUser?.id,
      };
      await onSave(payload, activity?.id);
      onClose();
    } catch(e) { notify(setMsg, e.message, "error"); }
    setSaving(false);
  };

  return (
    <Modal title={isEdit ? "✏️ Edit Jadwal" : "➕ Buat Jadwal Baru"} onClose={onClose} wide>
      {msg && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:12, fontSize:12, background:"#1c0a0a", color:"#ef4444" }}>{msg.text}</div>}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {/* Jenis & Tanggal */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Tanggal *</label>
            <input type="date" style={INP} value={form.activity_date} onChange={e=>setForm(f=>({...f,activity_date:e.target.value}))} />
            {/* Time row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginTop:8 }}>
              <div>
                <label style={{ fontSize:10, color:"#64748b" }}>Jam Mulai</label>
                <input type="time" style={{ ...INP, marginTop:2 }} value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:10, color:"#64748b" }}>Jam Selesai</label>
                <input type="time" style={{ ...INP, marginTop:2 }} value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} />
              </div>
              <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                <label style={{ fontSize:10, color:"#64748b", marginBottom:2 }}>Durasi</label>
                <div style={{ background:"#060d1a", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", fontSize:12, fontWeight:700, color: calcDuration(form.start_time, form.end_time) ? "#38bdf8" : "#334155" }}>
                  {calcDuration(form.start_time, form.end_time) || "—"}
                </div>
              </div>
            </div>
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Jenis Aktivitas *</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {Object.entries(ACT_CONFIG).map(([v,c]) => (
                <button key={v} onClick={()=>setForm(f=>({...f,activity_type:v}))} style={{ padding:"7px 6px", borderRadius:8, fontSize:11, fontWeight:700, cursor:"pointer", border:`1px solid ${form.activity_type===v?c.color:"#1e293b"}`, background:form.activity_type===v?c.bg:"transparent", color:form.activity_type===v?c.color:"#475569" }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Anggota Tim - search picker */}
        <MemberPicker
          members={members}
          selectedIds={form.team_member_ids||[]}
          selectedNames={form.team_member_names||[]}
          onToggle={toggleMember}
          onClear={()=>setForm(f=>({...f,team_member_ids:[],team_member_names:[]}))}
          onAddNew={()=>setShowAddMember(true)}
        />

        {/* Perusahaan - search picker */}
        <CompanyPicker
          companies={companies}
          selectedId={form.company_id}
          selectedName={form.company_name}
          selectedStatus={form.company_status}
          onSelect={selectCompany}
          onClear={()=>setForm(f=>({...f,company_id:"",company_name:"",company_status:"prospek"}))}
          onAddNew={()=>setShowAddCompany(true)}
        />

        {/* Outcome */}
        <div>
          <label style={{ fontSize:11, color:"#64748b" }}>Hasil / Outcome</label>
          <textarea style={{ ...INP, resize:"vertical" }} rows={2} value={form.outcome} onChange={e=>setForm(f=>({...f,outcome:e.target.value}))} placeholder="Hasil yang dicapai dari aktivitas ini..." />
        </div>

        {/* Catatan & Follow-up */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Catatan Tambahan</label>
            <textarea style={{ ...INP, resize:"vertical" }} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Info tambahan..." />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Follow-up / Rencana Berikutnya</label>
            <textarea style={{ ...INP, resize:"vertical" }} rows={2} value={form.follow_up} onChange={e=>setForm(f=>({...f,follow_up:e.target.value}))} placeholder="Tindak lanjut yang perlu dilakukan..." />
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={handleSave} disabled={saving} style={{ ...BTN, background:saving?"#1e293b":"#059669", minWidth:140 }}>{saving?"Menyimpan...":"💾 Simpan Jadwal"}</button>
          <button onClick={onClose} style={{ ...BTN, background:"transparent", border:"1px solid #334155", color:"#64748b" }}>Batal</button>
        </div>
      </div>

      {/* Quick Add Member */}
      {showAddMember && (
        <QuickAddModal title="+ Tambah Anggota Tim" fields={[["name","Nama *","text"],["position","Posisi","text"]]} onClose={()=>setShowAddMember(false)}
          onSave={async (data) => {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/team_members`, { method:"POST", headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${getToken()}`,"Prefer":"return=representation"}, body:JSON.stringify(data) });
            if (!res.ok) throw new Error(await res.text());
            const [newM] = await res.json();
            members.push(newM);
            toggleMember(newM);
            setShowAddMember(false);
          }}
        />
      )}

      {/* Quick Add Company */}
      {showAddCompany && (
        <QuickAddCompanyModal
          onClose={()=>setShowAddCompany(false)}
          onSave={async (data, status) => {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
              method:"POST",
              headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":`Bearer ${getToken()}`,"Prefer":"return=representation"},
              body:JSON.stringify({...data, status: status||"prospek"})
            });
            if (!res.ok) throw new Error(await res.text());
            const [newC] = await res.json();
            companies.push(newC);
            selectCompany(newC);
            setShowAddCompany(false);
            // If klien, show project creation modal
            if (status === "klien") {
              setNewClientData({ name: data.name, pic_name: data.pic_name||"", pic_phone: data.pic_phone||"" });
            }
          }}
        />
      )}

      {newClientData && (
        <NewClientProjectModal
          company={newClientData}
          onClose={() => setNewClientData(null)}
          onCreated={() => { setNewClientData(null); }}
        />
      )}
    </Modal>
  );
}

// ─── DETAIL AKTIVITAS ─────────────────────────────────────────────────────────
function ActivityDetailModal({ activity, onClose, onEdit, onDelete, isAdmin }) {
  const ac = ACT_CONFIG[activity.activity_type] || ACT_CONFIG.meeting;
  return (
    <Modal title={`${ac.icon} Detail Aktivitas`} onClose={onClose}>
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <Badge type={activity.activity_type} config={ACT_CONFIG} />
          <Badge type={activity.company_status || "prospek"} config={STATUS_CONFIG} />
          <span style={{ fontSize:12, color:"#475569" }}>📅 {fmtDate(activity.activity_date)}</span>
        </div>
        {[
          ["👤 Anggota Tim", activity.team_member_name],
          ["🏢 Perusahaan", activity.company_name],
          ["🕐 Waktu", activity.start_time ? `${activity.start_time}${activity.end_time ? ` – ${activity.end_time}` : ""}${calcDuration(activity.start_time, activity.end_time) ? ` (${calcDuration(activity.start_time, activity.end_time)})` : ""}` : "-"],
          ["✅ Outcome", activity.outcome || "-"],
          ["📝 Catatan", activity.notes || "-"],
          ["🔄 Follow-up", activity.follow_up || "-"],
        ].map(([label, val]) => (
          <div key={label} style={MINI}>
            <div style={{ fontSize:11, color:"#475569", marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:13, color:"#e2e8f0", whiteSpace:"pre-wrap" }}>{val}</div>
          </div>
        ))}
        {isAdmin && (
          <div style={{ display:"flex", gap:10, marginTop:4 }}>
            <button onClick={onEdit} style={{ ...BTN }}>✏️ Edit</button>
            <button onClick={onDelete} style={{ ...BTN, background:"#1c0a0a", border:"1px solid #7f1d1d", color:"#ef4444" }}>🗑 Hapus</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── SYNC TO SESSION MODAL ───────────────────────────────────────────────────
function SyncToSessionModal({ activity, projects, isEdit, onClose, onConfirm }) {
  const [selectedProject, setSelectedProject] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.client||"").toLowerCase().includes(projectSearch.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selectedProject) return;
    setSaving(true);
    await onConfirm(selectedProject);
    setSaving(false);
  };

  const sessionType = activity.activity_type === "onsite" ? "Onsite IT" : "Training";
  const memberNames = Array.isArray(activity.team_member_names)
    ? activity.team_member_names
    : activity.team_member_name ? [activity.team_member_name] : [];

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:5000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:28, maxWidth:480, width:"100%", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:"#f1f5f9" }}>
              {isEdit ? "🔄 Sinkronkan Sesi Layanan" : "➕ Buat Sesi Layanan Teknis?"}
            </div>
            <div style={{ fontSize:12, color:"#475569", marginTop:4 }}>
              Jadwal {sessionType} ini akan {isEdit ? "memperbarui" : "membuat"} sesi di modul Layanan Teknis
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {/* Activity summary */}
        <div style={{ background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:"12px 14px", marginBottom:16 }}>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
            <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:700, background:activity.activity_type==="onsite"?"#052e16":"#0c2a3f", color:activity.activity_type==="onsite"?"#10b981":"#38bdf8" }}>
              {activity.activity_type==="onsite"?"🔧 Onsite IT":"📚 Training"}
            </span>
            <span style={{ fontSize:12, color:"#475569" }}>📅 {activity.activity_date}</span>
            {activity.start_time && <span style={{ fontSize:12, color:"#475569" }}>🕐 {activity.start_time}{activity.end_time?`–${activity.end_time}`:""}</span>}
          </div>
          <div style={{ fontSize:13, color:"#e2e8f0" }}>
            👥 {memberNames.join(", ") || activity.team_member_name || "-"}
          </div>
          {activity.company_name && <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>🏢 {activity.company_name}</div>}
        </div>

        {/* Project picker */}
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"#64748b", display:"block", marginBottom:8 }}>
            Pilih Proyek yang Terkait *
          </label>
          <div style={{ position:"relative", marginBottom:8 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:12 }}>🔍</span>
            <input style={{ width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px 8px 30px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
              placeholder="Cari proyek..." value={projectSearch} onChange={e=>setProjectSearch(e.target.value)} autoFocus />
          </div>
          <div style={{ maxHeight:200, overflowY:"auto", display:"flex", flexDirection:"column", gap:4 }}>
            {filteredProjects.map(p => (
              <button key={p.id} onClick={()=>setSelectedProject(p.id)} style={{
                padding:"9px 12px", borderRadius:8, border:`1px solid ${selectedProject===p.id?"#38bdf8":"#1e293b"}`,
                background:selectedProject===p.id?"#0c2a3f":"transparent",
                color:"#e2e8f0", cursor:"pointer", textAlign:"left", fontSize:13,
              }}>
                <div style={{ fontWeight:600 }}>{p.name}</div>
                {p.client && <div style={{ fontSize:11, color:"#475569" }}>{p.client}</div>}
              </button>
            ))}
            {filteredProjects.length === 0 && <div style={{ color:"#334155", fontSize:12, padding:8 }}>Proyek tidak ditemukan</div>}
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={handleConfirm} disabled={!selectedProject || saving} style={{
            flex:1, padding:"10px", borderRadius:8, border:"none",
            background:!selectedProject||saving?"#1e293b":"#059669",
            color:!selectedProject||saving?"#475569":"#fff",
            cursor:!selectedProject||saving?"not-allowed":"pointer", fontWeight:600, fontSize:14,
          }}>
            {saving?"Menyimpan...":isEdit?"🔄 Sinkronkan":"✅ Ya, Buat Sesi"}
          </button>
          <button onClick={onClose} style={{ padding:"10px 16px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>
            Lewati
          </button>
        </div>
        <div style={{ marginTop:10, fontSize:11, color:"#334155", textAlign:"center" }}>
          Klik "Lewati" jika tidak ingin membuat sesi layanan teknis
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ActivityPage({ onClose, currentUser, isAdmin }) {
  const [activities, setActivities] = useState([]);
  const [members, setMembers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [syncConfirm, setSyncConfirm] = useState(null); // {activity, isEdit}

  const [showForm, setShowForm] = useState(false);
  const [editActivity, setEditActivity] = useState(null);
  const [detailActivity, setDetailActivity] = useState(null);
  const [showTeamMaster, setShowTeamMaster] = useState(false);
  const [showCompanyMaster, setShowCompanyMaster] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMember, setFilterMember] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [acts, mems, comps, projs] = await Promise.all([
        dbGet("team_activities", "?order=activity_date.desc,created_at.desc"),
        dbGet("team_members", "?order=name.asc&is_active=eq.true"),
        dbGet("companies", "?order=name.asc"),
        dbGet("projects", "?select=id,name,client&order=name.asc"),
      ]);
      setActivities(acts);
      setMembers(mems);
      setCompanies(comps);
      setProjects(projs || []);
    } catch(e) { notify(setMsg, e.message, "error"); }
    setLoading(false);
  };

  const handleSave = async (payload, id) => {
    let savedActivity;
    if (id) {
      const res = await dbPatch("team_activities", id, payload);
      savedActivity = Array.isArray(res) ? res[0] : { ...payload, id };
    } else {
      const res = await dbPost("team_activities", payload);
      savedActivity = Array.isArray(res) ? res[0] : payload;
    }
    await loadAll();
    notify(setMsg, id ? "Jadwal diupdate!" : "Jadwal berhasil dibuat!");
    logActivity({ action: id?"edit":"tambah", module:"jadwal", description:`${id?"Edit":"Tambah"} jadwal: ${payload.company_name} - ${payload.activity_type}` });

    // Trigger sync confirm for training/onsite types
    if (payload.activity_type === "training" || payload.activity_type === "onsite") {
      setSyncConfirm({ activity: { ...payload, id: savedActivity?.id || id }, isEdit: !!id });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Hapus jadwal ini?")) return;
    try {
      // Also delete linked training session if exists
      const act = activities.find(a => a.id === id);
      if (act && (act.activity_type === "training" || act.activity_type === "onsite")) {
        try {
          await dbDelete("training_sessions", `source_activity_id=eq.${id}`);
        } catch(e) { /* ignore if no linked session */ }
      }
      await dbDelete("team_activities", id);
      setDetailActivity(null);
      await loadAll();
      notify(setMsg,"Jadwal dihapus!");
      logActivity({ action:"hapus", module:"jadwal", description:"Hapus jadwal aktivitas" });
    }
    catch(e) { notify(setMsg, e.message, "error"); }
  };

  // Sync activity to training session
  const handleSyncToSession = async (projectId) => {
    const act = syncConfirm.activity;
    const isEdit = syncConfirm.isEdit;
    const memberNames = Array.isArray(act.team_member_names) ? act.team_member_names : (act.team_member_name ? [act.team_member_name] : []);
    const person1Name = memberNames[0] || act.team_member_name || "";
    const person2Name = memberNames[1] || null;

    const sessionPayload = {
      project_id: projectId,
      training_date: act.activity_date,
      session_type: act.activity_type === "onsite" ? "onsite" : "training",
      is_online: false,
      trainer_name: person1Name,
      is_partner: false,
      use_vehicle: false,
      has_second_person: !!person2Name,
      person2_name: person2Name,
      person2_is_partner: false,
      person2_vehicle: false,
      technician_count: person2Name ? 2 : 1,
      topic: act.outcome || act.notes || "",
      participants: act.company_name || "",
      start_time: act.start_time || null,
      end_time: act.end_time || null,
      hours_used: (() => {
        if (act.start_time && act.end_time) {
          const [sh,sm] = act.start_time.split(":").map(Number);
          const [eh,em] = act.end_time.split(":").map(Number);
          const diff = (eh*60+em)-(sh*60+sm);
          return diff > 0 ? Math.round(diff/60*10)/10 : 1;
        }
        return 1;
      })(),
      source_activity_id: act.id,
      created_by: currentUser?.id || null,
    };

    try {
      if (isEdit) {
        // Find existing session linked to this activity and update it
        const existing = await dbGet("training_sessions", `?source_activity_id=eq.${act.id}&limit=1`);
        if (existing && existing.length > 0) {
          await dbPatch("training_sessions", existing[0].id, sessionPayload);
          notify(setMsg, "✅ Sesi layanan teknis diperbarui!");
        } else {
          await dbPost("training_sessions", sessionPayload);
          notify(setMsg, "✅ Sesi layanan teknis dibuat!");
        }
      } else {
        await dbPost("training_sessions", sessionPayload);
        notify(setMsg, "✅ Sesi layanan teknis otomatis dibuat!");
      }
    } catch(e) {
      notify(setMsg, "Gagal sync ke sesi layanan: " + e.message, "error");
    }
    setSyncConfirm(null);
  };

  // Filter
  const userId = currentUser?.id;
  const userName = currentUser?.profile?.full_name || currentUser?.email;

  const filtered = activities.filter(a => {
    if (!isAdmin && a.created_by !== userId && a.team_member_name !== userName) return false;
    if (filterType !== "all" && a.activity_type !== filterType) return false;
    if (filterStatus !== "all" && a.company_status !== filterStatus) return false;
    if (filterMember !== "all" && a.team_member_name !== filterMember) return false;
    if (search && !a.company_name.toLowerCase().includes(search.toLowerCase()) && !a.team_member_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (dateFrom && a.activity_date < dateFrom) return false;
    if (dateTo && a.activity_date > dateTo) return false;
    return true;
  });

  const uniqueMembers = [...new Set(activities.flatMap(a => a.team_member_names || (a.team_member_name ? [a.team_member_name] : [])))].sort();

  // Stats
  const stats = {
    total: filtered.length,
    klien: filtered.filter(a => a.company_status === "klien").length,
    prospek: filtered.filter(a => a.company_status === "prospek").length,
    thisMonth: filtered.filter(a => a.activity_date?.startsWith(new Date().toISOString().slice(0,7))).length,
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#060d1a", zIndex:2000, overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0c1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:3px}`}</style>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28, flexWrap:"wrap", gap:16 }}>
          <div>
            <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, marginBottom:8, padding:0, display:"flex", alignItems:"center", gap:6 }}>← Kembali ke Dashboard</button>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#f1f5f9", margin:0 }}>📅 Jadwal Aktivitas</h1>
            <div style={{ fontSize:13, color:"#475569", marginTop:6 }}>{!isAdmin && "Menampilkan jadwal Anda saja"}</div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {isAdmin && <>
              <button onClick={()=>setShowTeamMaster(true)} style={{ ...BTN, background:"#0c2a3f", border:"1px solid #38bdf8", color:"#38bdf8" }}>👥 Master Tim</button>
              <button onClick={()=>setShowCompanyMaster(true)} style={{ ...BTN, background:"#0a1525", border:"1px solid #64748b", color:"#94a3b8" }}>🏢 Master Perusahaan</button>
            </>}
            <button onClick={()=>{ setEditActivity(null); setShowForm(true); }} style={BTN}>+ + Buat Jadwal</button>
          </div>
        </div>

        {/* Notification */}
        {msg && <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:16, fontSize:13, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>{msg.text}</div>}

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
          {[["Total Jadwal",stats.total,"#38bdf8","📋"],["Bulan Ini",stats.thisMonth,"#a78bfa","📅"],["Ke Klien",stats.klien,"#10b981","✅"],["Ke Prospek",stats.prospek,"#f59e0b","🎯"]].map(([l,v,c,i])=>(
            <div key={l} style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:20 }}>{i}</div>
              <div style={{ fontSize:26, fontWeight:800, color:c, lineHeight:1.2 }}>{v}</div>
              <div style={{ fontSize:11, color:"#475569" }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ ...MINI, marginBottom:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Dari Tanggal</label>
              <input type="date" style={{ ...INP, marginTop:0 }} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Sampai Tanggal</label>
              <input type="date" style={{ ...INP, marginTop:0 }} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Anggota Tim</label>
              <select style={{ ...INP, marginTop:0, cursor:"pointer" }} value={filterMember} onChange={e=>setFilterMember(e.target.value)}>
                <option value="all">Semua</option>
                {uniqueMembers.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Cari Perusahaan / Tim</label>
              <div style={{ position:"relative" }}>
                <span style={{ position:"absolute", left:8, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:12 }}>🔍</span>
                <input style={{ ...INP, marginTop:0, paddingLeft:28 }} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ketik nama..." />
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {/* Activity type */}
            {[["all","Semua","#64748b"],["presentasi","📊 Presentasi","#a78bfa"],["meeting","🤝 Meeting","#38bdf8"],["onsite","🔧 Onsite","#10b981"],["training","📚 Training","#f59e0b"]].map(([v,l,c])=>(
              <button key={v} onClick={()=>setFilterType(v)} style={{ padding:"5px 12px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer", border:`1px solid ${filterType===v?c:"#1e293b"}`, background:filterType===v?"#0c1628":"transparent", color:filterType===v?c:"#475569" }}>{l}</button>
            ))}
            <div style={{ width:1, background:"#1e293b", margin:"0 4px" }} />
            {[["all","Semua","#64748b"],["klien","Klien","#10b981"],["prospek","Prospek","#f59e0b"]].map(([v,l,c])=>(
              <button key={v} onClick={()=>setFilterStatus(v)} style={{ padding:"5px 12px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer", border:`1px solid ${filterStatus===v?c:"#1e293b"}`, background:filterStatus===v?"#0c1628":"transparent", color:filterStatus===v?c:"#475569" }}>{l}</button>
            ))}
            {(filterType!=="all"||filterStatus!=="all"||filterMember!=="all"||search||dateFrom||dateTo) && (
              <button onClick={()=>{setFilterType("all");setFilterStatus("all");setFilterMember("all");setSearch("");setDateFrom("");setDateTo("");}} style={{ padding:"5px 12px", borderRadius:999, fontSize:11, cursor:"pointer", border:"1px solid #334155", background:"transparent", color:"#64748b" }}>✕ Reset</button>
            )}
          </div>
          <div style={{ marginTop:10, fontSize:12, color:"#334155" }}>Menampilkan <span style={{ color:"#38bdf8", fontWeight:600 }}>{filtered.length}</span> aktivitas</div>
        </div>

        {/* Activity List */}
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#475569" }}>Memuat jadwal...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#334155" }}>
            <div style={{ fontSize:40 }}>📭</div>
            <div style={{ marginTop:12, fontSize:15 }}>Belum ada jadwal tercatat</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {filtered.map(a => {
              const ac = ACT_CONFIG[a.activity_type] || ACT_CONFIG.meeting;
              const sc = STATUS_CONFIG[a.company_status] || STATUS_CONFIG.prospek;
              return (
                <div key={a.id} onClick={()=>setDetailActivity(a)} style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:14, padding:18, cursor:"pointer", transition:"border-color 0.2s, transform 0.1s" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="#2563eb";e.currentTarget.style.transform="translateY(-1px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="#1a2744";e.currentTarget.style.transform="translateY(0)";}}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                    <div style={{ display:"flex", gap:10, alignItems:"flex-start", flex:1, minWidth:0 }}>
                      <div style={{ width:42, height:42, borderRadius:12, background:ac.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0, border:`1px solid ${ac.color}33` }}>{ac.icon}</div>
                      <div style={{ minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{a.company_name}</span>
                          <Badge type={a.company_status||"prospek"} config={STATUS_CONFIG} />
                          <Badge type={a.activity_type} config={ACT_CONFIG} />
                        </div>
                        <div style={{ fontSize:12, color:"#475569" }}>
                          👤 {a.team_member_name} · 📅 {fmtDate(a.activity_date)}
                          {a.start_time && <span> · 🕐 {a.start_time}{a.end_time ? `–${a.end_time}` : ""}{calcDuration(a.start_time,a.end_time) ? <span style={{color:"#38bdf8"}}> ({calcDuration(a.start_time,a.end_time)})</span> : ""}</span>}
                        </div>
                        {a.outcome && <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>✅ {a.outcome.slice(0,80)}{a.outcome.length>80?"...":""}</div>}
                        {a.follow_up && <div style={{ fontSize:11, color:"#f59e0b", marginTop:2 }}>🔄 {a.follow_up.slice(0,60)}{a.follow_up.length>60?"...":""}</div>}
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:"#334155", flexShrink:0 }}>Klik untuk detail →</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showForm && <ActivityFormModal activity={editActivity} members={members} companies={companies} currentUser={currentUser} onClose={()=>{setShowForm(false);setEditActivity(null);}} onSave={handleSave} />}
      {syncConfirm && (
        <SyncToSessionModal
          activity={syncConfirm.activity}
          projects={projects}
          isEdit={syncConfirm.isEdit}
          onClose={()=>setSyncConfirm(null)}
          onConfirm={handleSyncToSession}
        />
      )}
      {detailActivity && <ActivityDetailModal activity={detailActivity} onClose={()=>setDetailActivity(null)} isAdmin={isAdmin}
        onEdit={()=>{setEditActivity(detailActivity);setDetailActivity(null);setShowForm(true);}}
        onDelete={()=>handleDelete(detailActivity.id)} />}
      {showTeamMaster && <TeamMasterModal onClose={()=>{setShowTeamMaster(false);loadAll();}} />}
      {showCompanyMaster && <CompanyMasterModal onClose={()=>{setShowCompanyMaster(false);loadAll();}} />}
    </div>
  );
}
