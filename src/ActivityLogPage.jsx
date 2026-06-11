import { useState, useEffect } from "react";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

function getToken() {
  try { return JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY; }
  catch { return SUPABASE_KEY; }
}

async function dbGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${getToken()}` }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbDelete(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${getToken()}` }
  });
  if (!res.ok) throw new Error(await res.text());
}

function fmtDateTime(d) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleString("id-ID", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

const MODULE_CONFIG = {
  dashboard:      { icon:"📁", color:"#38bdf8", label:"Dashboard" },
  layanan_teknis: { icon:"🔧", color:"#10b981", label:"Layanan Teknis" },
  jadwal:         { icon:"📅", color:"#a78bfa", label:"Jadwal Aktivitas" },
  komisi:         { icon:"💰", color:"#f59e0b", label:"Komisi" },
  data_master:    { icon:"🗂", color:"#64748b", label:"Data Master" },
  kalender:       { icon:"🗓", color:"#38bdf8", label:"Kalender" },
  users:          { icon:"👥", color:"#a78bfa", label:"Users" },
  roles:          { icon:"🔐", color:"#ef4444", label:"Role & Akses" },
  auth:           { icon:"🔑", color:"#f59e0b", label:"Auth" },
  proyek:         { icon:"📋", color:"#10b981", label:"Proyek" },
  perusahaan:     { icon:"🏢", color:"#38bdf8", label:"Perusahaan" },
};

const ACTION_COLOR = {
  create: "#10b981", tambah: "#10b981",
  update: "#f59e0b", edit: "#f59e0b", ubah: "#f59e0b",
  delete: "#ef4444", hapus: "#ef4444",
  login:  "#a78bfa", logout: "#64748b",
  export: "#38bdf8", view: "#475569",
};

function getActionColor(action) {
  const key = Object.keys(ACTION_COLOR).find(k => action?.toLowerCase().includes(k));
  return key ? ACTION_COLOR[key] : "#475569";
}

const ROLE_COLOR = { admin:"#a78bfa", editor:"#38bdf8", trainer:"#f59e0b", viewer:"#64748b" };

export default function ActivityLogPage({ onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterUser, setFilterUser] = useState("all");
  const [filterModule, setFilterModule] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Users list for filter
  const [users, setUsers] = useState([]);

  useEffect(() => {
    dbGet("user_profiles", "?order=full_name.asc&select=id,full_name,role")
      .then(setUsers).catch(() => {});
  }, []);

  useEffect(() => { loadLogs(); }, [filterUser, filterModule, filterDate, search, page]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let params = `?order=created_at.desc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;
      if (filterUser !== "all") params += `&user_id=eq.${filterUser}`;
      if (filterModule !== "all") params += `&module=eq.${filterModule}`;
      if (filterDate) params += `&created_at=gte.${filterDate}T00:00:00&created_at=lte.${filterDate}T23:59:59`;
      if (search) params += `&description=ilike.*${search}*`;

      const data = await dbGet("activity_logs", params);
      setLogs(data);
    } catch(e) { setMsg({ text: e.message, type: "error" }); }
    setLoading(false);
  };

  const handleClearLogs = async () => {
    if (!window.confirm("Hapus SEMUA log aktivitas? Tindakan ini tidak bisa dibatalkan!")) return;
    try {
      await dbDelete("activity_logs", "id=not.is.null");
      setLogs([]);
      setMsg({ text: "Semua log berhasil dihapus", type: "success" });
      setTimeout(() => setMsg(null), 3000);
    } catch(e) { setMsg({ text: e.message, type: "error" }); }
  };

  const resetFilters = () => {
    setFilterUser("all"); setFilterModule("all");
    setFilterDate(""); setSearch(""); setPage(0);
  };

  const hasFilter = filterUser !== "all" || filterModule !== "all" || filterDate || search;
  const uniqueModules = [...new Set(logs.map(l => l.module))].filter(Boolean).sort();

  return (
    <div style={{ position:"fixed", inset:0, background:"#060d1a", zIndex:2000, overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0c1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:3px}`}</style>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:16 }}>
          <div>
            <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, marginBottom:8, padding:0 }}>← Kembali ke Dashboard</button>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#f1f5f9", margin:0 }}>📋 Log Aktivitas</h1>
            <div style={{ fontSize:13, color:"#475569", marginTop:4 }}>Rekam jejak semua aktivitas user di aplikasi</div>
          </div>
          <button onClick={handleClearLogs} style={{ padding:"9px 18px", borderRadius:8, border:"1px solid #7f1d1d", background:"#1c0a0a", color:"#ef4444", cursor:"pointer", fontSize:13, fontWeight:600 }}>
            🗑 Hapus Semua Log
          </button>
        </div>

        {msg && (
          <div style={{ padding:"10px 14px", borderRadius:10, marginBottom:16, fontSize:13, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>
            {msg.text}
          </div>
        )}

        {/* Filters */}
        <div style={{ background:"#0a1525", border:"1px solid #1a2744", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            {/* Search */}
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:12 }}>🔍</span>
              <input style={{ width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px 8px 30px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
                placeholder="Cari deskripsi..." value={search} onChange={e=>{ setSearch(e.target.value); setPage(0); }} />
            </div>
            {/* User filter */}
            <select style={{ background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", cursor:"pointer" }}
              value={filterUser} onChange={e=>{ setFilterUser(e.target.value); setPage(0); }}>
              <option value="all">👤 Semua User</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.id.slice(0,8)}</option>)}
            </select>
            {/* Module filter */}
            <select style={{ background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", cursor:"pointer" }}
              value={filterModule} onChange={e=>{ setFilterModule(e.target.value); setPage(0); }}>
              <option value="all">📦 Semua Modul</option>
              {Object.entries(MODULE_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
            {/* Date filter */}
            <input type="date" style={{ background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", cursor:"pointer" }}
              value={filterDate} onChange={e=>{ setFilterDate(e.target.value); setPage(0); }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:12, color:"#475569" }}>
              Menampilkan <span style={{ color:"#38bdf8", fontWeight:600 }}>{logs.length}</span> log
              {hasFilter && <span> (filter aktif)</span>}
            </div>
            {hasFilter && (
              <button onClick={resetFilters} style={{ padding:"4px 12px", borderRadius:6, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:12 }}>✕ Reset Filter</button>
            )}
          </div>
        </div>

        {/* Log table */}
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#475569" }}>Memuat log aktivitas...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#334155" }}>
            <div style={{ fontSize:40 }}>📭</div>
            <div style={{ fontSize:15, marginTop:12 }}>{hasFilter ? "Tidak ada log yang cocok" : "Belum ada log aktivitas"}</div>
            <div style={{ fontSize:12, color:"#334155", marginTop:6 }}>Log akan muncul seiring penggunaan aplikasi</div>
          </div>
        ) : (
          <>
            <div style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:14, overflow:"hidden" }}>
              {/* Table header */}
              <div style={{ display:"grid", gridTemplateColumns:"180px 140px 120px 1fr 100px", gap:0, padding:"10px 16px", borderBottom:"1px solid #1a2744", background:"#080f1e" }}>
                {["Waktu","User","Modul","Deskripsi","Aksi"].map(h => (
                  <div key={h} style={{ fontSize:10, fontWeight:700, color:"#334155", textTransform:"uppercase", letterSpacing:0.8 }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              {logs.map((log, i) => {
                const mod = MODULE_CONFIG[log.module] || { icon:"📌", color:"#64748b", label: log.module };
                const actionColor = getActionColor(log.action);
                const roleColor = ROLE_COLOR[log.user_role] || "#64748b";
                return (
                  <div key={log.id} style={{ display:"grid", gridTemplateColumns:"180px 140px 120px 1fr 100px", gap:0, padding:"10px 16px", borderBottom:"1px solid #0f172a", background: i%2===0?"transparent":"#0a1525", transition:"background 0.1s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#0c2a3f22"}
                    onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"#0a1525"}>
                    {/* Waktu */}
                    <div style={{ fontSize:12, color:"#475569" }}>{fmtDateTime(log.created_at)}</div>
                    {/* User */}
                    <div>
                      <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0" }}>{log.user_name || "System"}</div>
                      <span style={{ fontSize:10, padding:"1px 6px", borderRadius:999, background:"#0a1525", color:roleColor, fontWeight:600 }}>{log.user_role || "-"}</span>
                    </div>
                    {/* Modul */}
                    <div>
                      <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:600, background:mod.color+"22", color:mod.color }}>
                        {mod.icon} {mod.label}
                      </span>
                    </div>
                    {/* Deskripsi */}
                    <div style={{ fontSize:12, color:"#94a3b8", paddingRight:8 }}>{log.description || "-"}</div>
                    {/* Aksi */}
                    <div>
                      <span style={{ padding:"2px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:actionColor+"22", color:actionColor }}>
                        {log.action}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16 }}>
              <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={{ padding:"7px 16px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:page===0?"#334155":"#64748b", cursor:page===0?"not-allowed":"pointer" }}>
                ← Sebelumnya
              </button>
              <span style={{ fontSize:12, color:"#475569" }}>Halaman {page+1}</span>
              <button onClick={()=>setPage(p=>p+1)} disabled={logs.length < PAGE_SIZE} style={{ padding:"7px 16px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:logs.length<PAGE_SIZE?"#334155":"#64748b", cursor:logs.length<PAGE_SIZE?"not-allowed":"pointer" }}>
                Berikutnya →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
