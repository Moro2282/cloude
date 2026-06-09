import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

const TARIF_INTERNAL   = 100000;
const TARIF_PARTNER    = 150000;
const TARIF_ONSITE_1   = 100000; // 1 teknisi
const TARIF_ONSITE_2   = 70000;  // 2 teknisi per orang
const TARIF_KENDARAAN  = 100000;

function getToken() {
  try { return JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY; }
  catch { return SUPABASE_KEY; }
}

function hdrs() {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${getToken()}`,
  };
}

function fmtRp(n) {
  return "Rp " + n.toLocaleString("id-ID");
}

function fmtDate(d) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}

async function fetchAllSessions() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/training_sessions?select=*,projects(name,client)&order=training_date.desc`,
    { headers: hdrs() }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getTarifPerson(isPartner, hasBuddy) {
  // Training tariff rules:
  // Solo internal: 100rb, Solo partner: 150rb
  // With buddy (either): internal 70rb, partner 100rb
  if (!hasBuddy) return isPartner ? TARIF_PARTNER : TARIF_INTERNAL;
  return isPartner ? 100000 : 70000;
}

function calcKomisi(session) {
  const jam = parseFloat(session.hours_used || 0);
  const hasBuddy = session.has_second_person && session.person2_name;
  
  let p1Tarif, p2Tarif, p1Komisi, p2Komisi, p1Vehicle, p2Vehicle;

  if (session.session_type === "onsite") {
    p1Tarif = hasBuddy ? TARIF_ONSITE_2 : TARIF_ONSITE_1;
    p2Tarif = hasBuddy ? TARIF_ONSITE_2 : 0;
    p1Vehicle = session.use_vehicle ? TARIF_KENDARAAN : 0;
    p2Vehicle = (hasBuddy && session.person2_vehicle) ? TARIF_KENDARAAN : 0;
  } else {
    p1Tarif = getTarifPerson(session.is_partner, hasBuddy);
    p2Tarif = hasBuddy ? getTarifPerson(session.person2_is_partner, true) : 0;
    p1Vehicle = session.use_vehicle ? TARIF_KENDARAAN : 0;
    p2Vehicle = (hasBuddy && session.person2_vehicle) ? TARIF_KENDARAAN : 0;
  }

  p1Komisi = jam * p1Tarif;
  p2Komisi = hasBuddy ? jam * p2Tarif : 0;
  
  const totalKomisiJam = p1Komisi + p2Komisi;
  const totalKendaraan = p1Vehicle + p2Vehicle;

  return {
    jam,
    p1Tarif, p2Tarif, p1Komisi, p2Komisi,
    p1Vehicle, p2Vehicle,
    komisiJam: totalKomisiJam,
    komisiKendaraan: totalKendaraan,
    total: totalKomisiJam + totalKendaraan,
    hasBuddy,
  };
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

// ─── EDIT SESSION FROM KOMISI ────────────────────────────────────────────────
function KomisiEditModal({ session, onClose, onSaved }) {
  const SUPA_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
  const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

  const [form, setForm] = useState({
    training_date: session.training_date || "",
    session_type: session.session_type || "training",
    is_online: session.is_online || false,
    trainer_name: session.trainer_name || "",
    is_partner: session.is_partner || false,
    use_vehicle: session.use_vehicle || false,
    has_second_person: session.has_second_person || false,
    person2_name: session.person2_name || "",
    person2_is_partner: session.person2_is_partner || false,
    person2_vehicle: session.person2_vehicle || false,
    topic: session.topic || "",
    participants: session.participants || "",
    start_time: session.start_time || "",
    end_time: session.end_time || "",
    hours_used: session.hours_used || 0,
    notes: session.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };

  const calcHours = (s, e) => {
    if (!s || !e) return parseFloat(form.hours_used) || 0;
    const [sh,sm] = s.split(":").map(Number);
    const [eh,em] = e.split(":").map(Number);
    const diff = (eh*60+em)-(sh*60+sm);
    return diff > 0 ? Math.round(diff/60*10)/10 : 0;
  };

  const hrs = calcHours(form.start_time, form.end_time);

  // Tarif display
  const hasBuddy = form.has_second_person && form.person2_name;
  const p1Tarif = form.session_type==="onsite" ? (hasBuddy?70000:100000) : (hasBuddy?(form.is_partner?100000:70000):(form.is_partner?150000:100000));
  const p2Tarif = hasBuddy ? (form.session_type==="onsite"?70000:(form.person2_is_partner?100000:70000)) : 0;
  const totalKomisi = hrs * p1Tarif + (hasBuddy ? hrs * p2Tarif : 0) + (form.use_vehicle?100000:0) + (hasBuddy&&form.person2_vehicle?100000:0);

  const handleSave = async () => {
    if (!form.trainer_name) { setErr("Nama wajib diisi"); return; }
    setSaving(true);
    try {
      const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPA_KEY;
      const updated = { ...form, hours_used: hrs || form.hours_used };
      const res = await fetch(`${SUPA_URL}/rest/v1/training_sessions?id=eq.${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type":"application/json", "apikey":SUPA_KEY, "Authorization":`Bearer ${token}`, "Prefer":"return=representation" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error(await res.text());
      const [data] = await res.json();
      onSaved(data);
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:28, maxWidth:700, width:"100%", maxHeight:"90vh", overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:"#f1f5f9" }}>✏️ Edit Sesi Layanan</div>
            <div style={{ fontSize:12, color:"#475569", marginTop:2 }}>Proyek: {session.projects?.name || "-"} · ID: {session.id?.slice(0,8)}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:22, cursor:"pointer" }}>✕</button>
        </div>

        {err && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:14, fontSize:12, background:"#1c0a0a", color:"#ef4444" }}>⚠️ {err}</div>}

        {/* Komisi preview */}
        <div style={{ background:"#052e16", border:"1px solid #10b98133", borderRadius:10, padding:"10px 16px", marginBottom:16, display:"flex", gap:16, flexWrap:"wrap" }}>
          <div><div style={{ fontSize:10, color:"#475569" }}>DURASI</div><div style={{ fontSize:16, fontWeight:700, color:"#38bdf8" }}>{hrs||form.hours_used} jam</div></div>
          <div><div style={{ fontSize:10, color:"#475569" }}>TARIF P1</div><div style={{ fontSize:14, fontWeight:600, color:"#94a3b8" }}>Rp {p1Tarif.toLocaleString("id")}/jam</div></div>
          {hasBuddy && <div><div style={{ fontSize:10, color:"#475569" }}>TARIF P2</div><div style={{ fontSize:14, fontWeight:600, color:"#94a3b8" }}>Rp {p2Tarif.toLocaleString("id")}/jam</div></div>}
          <div style={{ marginLeft:"auto" }}><div style={{ fontSize:10, color:"#475569" }}>TOTAL KOMISI</div><div style={{ fontSize:18, fontWeight:800, color:"#10b981" }}>Rp {totalKomisi.toLocaleString("id")}</div></div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Type + Online */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <div>
              <label style={{ fontSize:11, color:"#64748b" }}>Jenis Sesi</label>
              <div style={{ display:"flex", gap:6, marginTop:4 }}>
                {[["training","📚 Training","#38bdf8","#0c2a3f"],["onsite","🔧 Onsite IT","#10b981","#052e16"]].map(([v,l,c,bg])=>(
                  <button key={v} onClick={()=>setForm(f=>({...f,session_type:v}))} style={{ flex:1, padding:"7px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.session_type===v?c:"#1e293b"}`, background:form.session_type===v?bg:"transparent", color:form.session_type===v?c:"#475569" }}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize:11, color:"#64748b" }}>Tanggal</label>
              <input type="date" style={INP} value={form.training_date} onChange={e=>setForm(f=>({...f,training_date:e.target.value}))} />
            </div>
          </div>

          {/* Time */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            <div><label style={{ fontSize:11, color:"#64748b" }}>Jam Mulai</label><input type="time" style={INP} value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} /></div>
            <div><label style={{ fontSize:11, color:"#64748b" }}>Jam Selesai</label><input type="time" style={INP} value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} /></div>
            <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
              <label style={{ fontSize:11, color:"#64748b" }}>Durasi</label>
              <div style={{ ...INP, marginTop:4, color: hrs>0?"#38bdf8":"#334155", fontWeight:700 }}>{hrs>0?`${hrs} jam`:"—"}</div>
            </div>
          </div>

          {/* Person 1 */}
          <div style={{ background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:12 }}>
            <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:8 }}>👤 {form.session_type==="onsite"?"Teknisi 1":"Trainer / Orang 1"}</div>
            <input style={INP} value={form.trainer_name} onChange={e=>setForm(f=>({...f,trainer_name:e.target.value}))} placeholder="Nama" />
            {form.session_type==="training" && (
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                {[["internal",false,"🏢 Internal","#38bdf8","#0c2a3f"],["partner",true,"🤝 Partner","#a78bfa","#1e1040"]].map(([k,v,l,c,bg])=>(
                  <button key={k} onClick={()=>setForm(f=>({...f,is_partner:v}))} style={{ flex:1, padding:"6px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.is_partner===v?c:"#1e293b"}`, background:form.is_partner===v?bg:"transparent", color:form.is_partner===v?c:"#475569" }}>{l}</button>
                ))}
              </div>
            )}
            {!form.is_online && (
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#060d1a", borderRadius:8, padding:"7px 12px", marginTop:8 }}>
                <span style={{ fontSize:12, color:"#64748b" }}>🚗 Kendaraan Pribadi</span>
                <div onClick={()=>setForm(f=>({...f,use_vehicle:!f.use_vehicle}))} style={{ width:36,height:20,borderRadius:999,cursor:"pointer",background:form.use_vehicle?"#10b981":"#1e293b",position:"relative",transition:"background 0.2s" }}>
                  <div style={{ position:"absolute",top:2,left:form.use_vehicle?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }} />
                </div>
              </div>
            )}
          </div>

          {/* Person 2 toggle */}
          <button onClick={()=>setForm(f=>({...f,has_second_person:!f.has_second_person}))} style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", border:`1px solid ${form.has_second_person?"#ef444433":"#1e293b"}`, background:form.has_second_person?"#1c0a0a":"transparent", color:form.has_second_person?"#ef4444":"#64748b" }}>
            {form.has_second_person ? "✕ Hapus Orang Kedua" : "+ Tambah Orang Kedua"}
          </button>

          {form.has_second_person && (
            <div style={{ background:"#0a1525", border:"1px solid #1d4ed8", borderRadius:10, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#38bdf8", marginBottom:8 }}>👥 Orang 2</div>
              <input style={INP} value={form.person2_name} onChange={e=>setForm(f=>({...f,person2_name:e.target.value}))} placeholder="Nama orang kedua" />
              {form.session_type==="training" && (
                <div style={{ display:"flex", gap:6, marginTop:8 }}>
                  {[["internal",false,"🏢 Internal","#38bdf8","#0c2a3f"],["partner",true,"🤝 Partner","#a78bfa","#1e1040"]].map(([k,v,l,c,bg])=>(
                    <button key={k} onClick={()=>setForm(f=>({...f,person2_is_partner:v}))} style={{ flex:1, padding:"6px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.person2_is_partner===v?c:"#1e293b"}`, background:form.person2_is_partner===v?bg:"transparent", color:form.person2_is_partner===v?c:"#475569" }}>{l}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Materi & Peserta */}
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Materi / Topik</label>
            <textarea style={{ ...INP, resize:"vertical" }} rows={3} value={form.topic} onChange={e=>setForm(f=>({...f,topic:e.target.value}))} />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Peserta</label>
            <input style={INP} value={form.participants} onChange={e=>setForm(f=>({...f,participants:e.target.value}))} />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Catatan</label>
            <textarea style={{ ...INP, resize:"vertical" }} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={handleSave} disabled={saving} style={{ padding:"10px 24px", borderRadius:8, border:"none", background:saving?"#1e293b":"#1d4ed8", color:saving?"#475569":"#fff", cursor:saving?"not-allowed":"pointer", fontWeight:600, fontSize:14 }}>
              {saving?"Menyimpan...":"💾 Simpan Perubahan"}
            </button>
            <button onClick={onClose} style={{ padding:"10px 16px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>Batal</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function KomisiPage({ onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`;
  const todayStr = today.toISOString().split("T")[0];

  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo]     = useState(todayStr);
  const [filterTrainer, setFilterTrainer] = useState("all");
  const [filterStatus, setFilterStatus]   = useState("all"); // all | internal | partner
  const [viewMode, setViewMode]           = useState("ringkasan"); // ringkasan | detail

  useEffect(() => {
    fetchAllSessions()
      .then(data => { setSessions(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  // Filtered sessions
  const filtered = sessions.filter(s => {
    if (dateFrom && s.training_date < dateFrom) return false;
    if (dateTo   && s.training_date > dateTo)   return false;
    if (filterTrainer !== "all" && s.trainer_name !== filterTrainer) return false;
    if (filterStatus === "internal" && s.is_partner) return false;
    if (filterStatus === "partner"  && !s.is_partner) return false;
    return true;
  });

  // Group by trainer
  const byTrainer = {};
  const addToTrainer = (name, isPartner, komisiJam, kendaraan, jam, projectName, session, k) => {
    if (!byTrainer[name]) byTrainer[name] = { sessions: [], totalJam: 0, totalKomisiJam: 0, totalKendaraan: 0, totalKomisi: 0, projects: new Set(), isPartner };
    byTrainer[name].sessions.push({ ...session, ...k, _displayName: name, _isPartner: isPartner });
    byTrainer[name].totalJam        += jam;
    byTrainer[name].totalKomisiJam  += komisiJam;
    byTrainer[name].totalKendaraan  += kendaraan;
    byTrainer[name].totalKomisi     += komisiJam + kendaraan;
    byTrainer[name].projects.add(projectName);
  };

  filtered.forEach(s => {
    const k = calcKomisi(s);
    const proj = s.projects?.name || s.project_id;
    // Person 1
    addToTrainer(s.trainer_name, s.is_partner, k.p1Komisi, k.p1Vehicle, k.jam, proj, s, k);
    // Person 2 (separate row in trainer summary)
    if (k.hasBuddy && s.person2_name) {
      addToTrainer(s.person2_name, s.person2_is_partner, k.p2Komisi, k.p2Vehicle, k.jam, proj, s, k);
    }
  });

  const trainerList = Object.keys(byTrainer).sort();
  const allTrainers = [...new Set(sessions.map(s => s.trainer_name))].sort();

  const grandTotal = {
    jam: filtered.reduce((a, s) => a + parseFloat(s.hours_used||0), 0),
    komisi: Object.values(byTrainer).reduce((a, t) => a + t.totalKomisi, 0),
    kendaraan: Object.values(byTrainer).reduce((a, t) => a + t.totalKendaraan, 0),
    sesi: filtered.length,
  };

  // Export Excel
  const handleExport = () => {
    try {
      const wb = XLSX.utils.book_new();
      const tgl = `${fmtDate(dateFrom)} s/d ${fmtDate(dateTo)}`;
      const today = new Date().toLocaleDateString("id-ID");

      // Sheet 1 — Ringkasan per Trainer
      const ws1Rows = [
        [`REKAP KOMISI LAYANAN TEKNIS — ${tgl}`], [`Digenerate: ${today}`], [],
        ["No", "Nama", "Status", "Sesi", "Proyek", "Total Jam", "Komisi Jam", "Komisi Kendaraan", "Total Komisi"],
      ];
      trainerList.forEach((name, i) => {
        const t = byTrainer[name];
        ws1Rows.push([
          i+1, name,
          t.isPartner ? "Partner" : "Internal",
          t.sessions.length,
          [...t.projects].join(", "),
          t.totalJam,
          fmtRp(t.totalKomisiJam),
          fmtRp(t.totalKendaraan),
          fmtRp(t.totalKomisi),
        ]);
      });
      ws1Rows.push([]);
      ws1Rows.push(["", "TOTAL", "", grandTotal.sesi, "", grandTotal.jam, "", fmtRp(grandTotal.kendaraan), fmtRp(grandTotal.komisi)]);
      const ws1 = XLSX.utils.aoa_to_sheet(ws1Rows);
      ws1["!cols"] = [{wch:4},{wch:24},{wch:10},{wch:8},{wch:30},{wch:10},{wch:18},{wch:18},{wch:18}];
      XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan Komisi");

      // Sheet 2 — Detail per Sesi
      const ws2Rows = [
        [`DETAIL SESI LAYANAN — ${tgl}`], [`Digenerate: ${today}`], [],
        ["No","Tanggal","Jenis","Orang 1","Status 1","Tarif 1","Orang 2","Status 2","Tarif 2","Proyek","Peserta","Materi","Mulai","Selesai","Jam","Komisi Jam","Kendaraan","Total"],
      ];
      filtered.forEach((s, i) => {
        const k = calcKomisi(s);
        ws2Rows.push([
          i+1,
          s.training_date,
          s.session_type === "onsite" ? "Onsite IT" : "Training",
          s.trainer_name,
          s.session_type === "onsite" ? "Internal" : (s.is_partner ? "Partner" : "Internal"),
          fmtRp(k.p1Tarif) + "/jam",
          k.hasBuddy ? s.person2_name : "-",
          k.hasBuddy ? (s.session_type === "onsite" ? "Internal" : (s.person2_is_partner ? "Partner" : "Internal")) : "-",
          k.hasBuddy ? fmtRp(k.p2Tarif) + "/jam" : "-",
          s.projects?.name || "-",
          s.participants || "-",
          (s.topic || "-").split("\n").join("; "),
          s.start_time || "-",
          s.end_time || "-",
          k.jam,
          fmtRp(k.komisiJam),
          fmtRp(k.komisiKendaraan),
          fmtRp(k.total),
        ]);
      });
      ws2Rows.push([]);
      ws2Rows.push(["","TOTAL","","","","","","","","","","","","",grandTotal.jam,"",fmtRp(grandTotal.kendaraan),fmtRp(grandTotal.komisi)]);
      const ws2 = XLSX.utils.aoa_to_sheet(ws2Rows);
      ws2["!cols"] = [{wch:4},{wch:12},{wch:10},{wch:20},{wch:10},{wch:14},{wch:20},{wch:10},{wch:14},{wch:22},{wch:20},{wch:30},{wch:8},{wch:8},{wch:6},{wch:16},{wch:16},{wch:16}];
      XLSX.utils.book_append_sheet(wb, ws2, "Detail Sesi");

      XLSX.writeFile(wb, `Komisi_Training_${dateFrom}_${dateTo}.xlsx`);
    } catch(err) {
      alert("Export gagal: " + err.message);
      console.error("Export error:", err);
    }
  };

  const INP = { background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"7px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit" };
  const MINI = { background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:14 };

  return (
    <>
    <div style={{ position:"fixed", inset:0, background:"#060d1a", zIndex:2000, overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:#0c1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:3px}`}</style>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28, flexWrap:"wrap", gap:16 }}>
          <div>
            <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, marginBottom:8, display:"flex", alignItems:"center", gap:6, padding:0 }}>
              ← Kembali ke Dashboard
            </button>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#f1f5f9", margin:0 }}>💰 Rekap Komisi Layanan Teknis</h1>
            <div style={{ fontSize:13, color:"#475569", marginTop:6 }}>
              Training: Internal <span style={{ color:"#38bdf8", fontWeight:600 }}>Rp 100rb/jam</span> · Partner <span style={{ color:"#a78bfa", fontWeight:600 }}>Rp 150rb/jam</span> &nbsp;|&nbsp; Onsite: 1 Teknisi <span style={{ color:"#10b981", fontWeight:600 }}>Rp 100rb/jam</span> · 2 Teknisi <span style={{ color:"#f59e0b", fontWeight:600 }}>Rp 70rb/jam/orang</span> · Kendaraan <span style={{ color:"#10b981", fontWeight:600 }}>+Rp 100rb</span>
            </div>
          </div>
          <button onClick={handleExport} disabled={filtered.length===0} style={{
            padding:"11px 24px", borderRadius:8, border:"none",
            background:filtered.length===0?"#1e293b":"#059669",
            color:filtered.length===0?"#334155":"#fff",
            cursor:filtered.length===0?"not-allowed":"pointer", fontWeight:700, fontSize:14,
          }}>⬇️ Export Excel</button>
        </div>

        {/* Filter Panel */}
        <div style={{ ...MINI, marginBottom:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:1, marginBottom:14 }}>🎛 Filter</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, flexWrap:"wrap" }}>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Dari Tanggal</label>
              <input type="date" style={{ ...INP, width:"100%" }} value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Sampai Tanggal</label>
              <input type="date" style={{ ...INP, width:"100%" }} value={dateTo} onChange={e=>setDateTo(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Nama Trainer</label>
              <select style={{ ...INP, width:"100%", cursor:"pointer" }} value={filterTrainer} onChange={e=>setFilterTrainer(e.target.value)}>
                <option value="all">Semua Trainer</option>
                {allTrainers.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>Status Trainer</label>
              <div style={{ display:"flex", gap:6, marginTop:4 }}>
                {[["all","Semua","#64748b"],["internal","Internal","#38bdf8"],["partner","Partner","#a78bfa"]].map(([v,l,c])=>(
                  <button key={v} onClick={()=>setFilterStatus(v)} style={{
                    flex:1, padding:"6px 4px", borderRadius:8, fontSize:11, fontWeight:600, cursor:"pointer",
                    border:`1px solid ${filterStatus===v?c:"#1e293b"}`,
                    background:filterStatus===v?"#0c1628":"transparent",
                    color:filterStatus===v?c:"#475569",
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop:12, fontSize:12, color:"#334155" }}>
            Menampilkan <span style={{ color:"#38bdf8", fontWeight:600 }}>{filtered.length}</span> sesi · <span style={{ color:"#38bdf8", fontWeight:600 }}>{trainerList.length}</span> trainer
          </div>
        </div>

        {/* Grand Total Cards */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
          {[
            ["Total Sesi", grandTotal.sesi, "#38bdf8", "sesi"],
            ["Total Jam", grandTotal.jam.toFixed(1), "#f59e0b", "jam"],
            ["Komisi Kendaraan", fmtRp(grandTotal.kendaraan), "#10b981", ""],
            ["Total Komisi", fmtRp(grandTotal.komisi), "#a78bfa", ""],
          ].map(([l,v,c,u])=>(
            <div key={l} style={{ ...MINI, padding:"14px 16px" }}>
              <div style={{ fontSize:11, color:"#475569", marginBottom:6, textTransform:"uppercase", letterSpacing:0.8 }}>{l}</div>
              <div style={{ fontSize:20, fontWeight:800, color:c, lineHeight:1.2 }}>{v} <span style={{ fontSize:11, color:"#475569", fontWeight:400 }}>{u}</span></div>
            </div>
          ))}
        </div>

        {/* View toggle */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[["ringkasan","📊 Ringkasan per Trainer"],["detail","📋 Detail per Sesi"]].map(([v,l])=>(
            <button key={v} onClick={()=>setViewMode(v)} style={{
              padding:"7px 18px", borderRadius:999, fontSize:12, fontWeight:600, cursor:"pointer",
              border:`1px solid ${viewMode===v?"#38bdf8":"#1e293b"}`,
              background:viewMode===v?"#0c4a6e":"transparent",
              color:viewMode===v?"#38bdf8":"#64748b",
            }}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#475569" }}>Memuat data sesi layanan...</div>
        ) : error ? (
          <div style={{ textAlign:"center", padding:40, color:"#ef4444" }}>⚠️ {error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:"#334155" }}>
            <div style={{ fontSize:36 }}>📭</div>
            <div style={{ marginTop:12, fontSize:15 }}>Tidak ada sesi layanan di periode ini</div>
          </div>
        ) : viewMode === "ringkasan" ? (

          /* ── RINGKASAN PER TRAINER ── */
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {trainerList.map(name => {
              const t = byTrainer[name];
              const isPartner = t.sessions.some(s => s.is_partner);
              const hasVehicle = t.sessions.some(s => s.use_vehicle);
              const vehicleCount = t.sessions.filter(s => s.use_vehicle).length;
              return (
                <div key={name} style={{ ...MINI, borderLeft:`3px solid ${isPartner?"#a78bfa":"#38bdf8"}` }}>
                  {/* Trainer header */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12, marginBottom:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${isPartner?"#7c3aed,#a78bfa":"#1d4ed8,#38bdf8"})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:"#fff", flexShrink:0 }}>
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize:15, fontWeight:700, color:"#f1f5f9" }}>{name}</div>
                        <div style={{ display:"flex", gap:6, marginTop:4 }}>
                          <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:600, background:isPartner?"#1e1040":"#0c2a3f", color:isPartner?"#a78bfa":"#38bdf8" }}>
                            {isPartner?"🤝 Partner":"🏢 Internal"}
                          </span>
                          <span style={{ fontSize:11, color:"#475569" }}>{t.sessions.length} sesi · {[...t.projects].join(", ")}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:22, fontWeight:900, color:"#10b981" }}>{fmtRp(t.totalKomisi)}</div>
                      <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>total komisi</div>
                    </div>
                  </div>

                  {/* Breakdown */}
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                    {[
                      ["Total Jam", `${t.totalJam} jam`, "#f59e0b"],
                      ["Komisi Jam", fmtRp(t.totalKomisiJam), isPartner?"#a78bfa":"#38bdf8"],
                      ["Kendaraan", hasVehicle?fmtRp(t.totalKendaraan):"—", "#10b981"],
                      ["Total", fmtRp(t.totalKomisi), "#10b981"],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{ background:"#060d1a", borderRadius:8, padding:"10px 12px" }}>
                        <div style={{ fontSize:10, color:"#475569", textTransform:"uppercase", letterSpacing:0.8, marginBottom:4 }}>{l}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  {/* Session mini list */}
                  <div style={{ marginTop:12, borderTop:"1px solid #1e293b", paddingTop:12 }}>
                    <div style={{ fontSize:11, color:"#475569", marginBottom:8 }}>DETAIL SESI:</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                      {t.sessions.map((s,i) => (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 10px", background:"#060d1a", borderRadius:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:11, color:"#475569", minWidth:80 }}>{fmtDate(s.training_date)}</span>
                          <span style={{ fontSize:11, padding:"1px 6px", borderRadius:4, background: s.session_type==="onsite"?"#052e16":"#0c2a3f", color: s.session_type==="onsite"?"#10b981":"#38bdf8" }}>{s.session_type==="onsite"?"Onsite":"Training"}</span>
                          <span style={{ fontSize:12, color:"#94a3b8", flex:1 }}>{s.projects?.name || "-"} — {s.topic?.split("\n")[0]}</span>
                          <span style={{ fontSize:11, color:"#f59e0b", minWidth:50 }}>{s.jam} jam</span>
                          {s.use_vehicle && <span style={{ fontSize:10, color:"#10b981" }}>🚗 +{fmtRp(TARIF_KENDARAAN)}</span>}
                          <span style={{ fontSize:12, fontWeight:700, color:"#10b981", minWidth:90, textAlign:"right" }}>{fmtRp(s.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        ) : (

          /* ── DETAIL PER SESI ── */
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ background:"#0a1525" }}>
                  {["Tanggal","Trainer","Jenis","Status","Proyek","Peserta","Jam","Tarif/Jam","Komisi","Kendaraan","Total"].map(h=>(
                    <th key={h} style={{ padding:"10px 12px", textAlign:"left", fontSize:11, color:"#475569", fontWeight:600, textTransform:"uppercase", letterSpacing:0.8, borderBottom:"1px solid #1e293b", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s,i) => {
                  const k = calcKomisi(s);
                  return (
                    <tr key={s.id} onClick={()=>setEditTarget(s)} style={{ borderBottom:"1px solid #0f172a", background: i%2===0?"transparent":"#0a1525", cursor:"pointer" }}
                      onMouseEnter={e=>e.currentTarget.style.background="#0c2a3f33"}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"transparent":"#0a1525"}>
                      <td style={{ padding:"10px 12px", color:"#94a3b8", whiteSpace:"nowrap" }}>{fmtDate(s.training_date)}</td>
                      <td style={{ padding:"10px 12px", color:"#e2e8f0", fontWeight:600 }}>{s.trainer_name}</td>
                      <td style={{ padding:"10px 12px" }}>
                        <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:600, background: s.session_type==="onsite"?"#052e16":"#0c2a3f", color: s.session_type==="onsite"?"#10b981":"#38bdf8" }}>
                          {s.session_type==="onsite" ? "🔧 Onsite" : "📚 Training"}
                        </span>
                      </td>
                      <td style={{ padding:"10px 12px" }}>
                        {s.session_type === "onsite"
                          ? <span style={{ fontSize:11, color: s.technician_count===2?"#f59e0b":"#10b981" }}>{s.technician_count===2?"👥 2 Teknisi":"👤 1 Teknisi"}</span>
                          : <span style={{ padding:"2px 8px", borderRadius:999, fontSize:11, fontWeight:600, background:s.is_partner?"#1e1040":"#0c2a3f", color:s.is_partner?"#a78bfa":"#38bdf8" }}>{s.is_partner?"Partner":"Internal"}</span>
                        }
                      </td>
                      <td style={{ padding:"10px 12px", color:"#94a3b8" }}>{s.projects?.name||"-"}</td>
                      <td style={{ padding:"10px 12px", color:"#94a3b8", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.participants}</td>
                      <td style={{ padding:"10px 12px", color:"#f59e0b", fontWeight:600 }}>{k.jam}</td>
                      <td style={{ padding:"10px 12px", color:"#475569", fontSize:11 }}>
                        <div>{s.trainer_name}: {fmtRp(k.p1Tarif)}/jam</div>
                        {k.hasBuddy && <div style={{color:"#94a3b8"}}>{s.person2_name}: {fmtRp(k.p2Tarif)}/jam</div>}
                      </td>
                      <td style={{ padding:"10px 12px", color:"#38bdf8", fontWeight:600 }}>
                        <div>{fmtRp(k.p1Komisi)}</div>
                        {k.hasBuddy && <div style={{color:"#7dd3fc"}}>{fmtRp(k.p2Komisi)}</div>}
                      </td>
                      <td style={{ padding:"10px 12px", color: (s.use_vehicle||s.person2_vehicle)?"#10b981":"#334155" }}>
                        {s.use_vehicle && <div>{s.trainer_name}: {fmtRp(TARIF_KENDARAAN)}</div>}
                        {k.hasBuddy && s.person2_vehicle && <div style={{color:"#6ee7b7"}}>{s.person2_name}: {fmtRp(TARIF_KENDARAAN)}</div>}
                        {!s.use_vehicle && !s.person2_vehicle && "—"}
                      </td>
                      <td style={{ padding:"10px 12px", color:"#10b981", fontWeight:700 }}>{fmtRp(k.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:"#0a1525", borderTop:"2px solid #1e293b" }}>
                  <td colSpan={5} style={{ padding:"12px", color:"#64748b", fontWeight:600, fontSize:12 }}>TOTAL ({filtered.length} sesi)</td>
                  <td style={{ padding:"12px", color:"#f59e0b", fontWeight:700 }}>{grandTotal.jam.toFixed(1)}</td>
                  <td></td>
                  <td style={{ padding:"12px", color:"#38bdf8", fontWeight:700 }}>{fmtRp(grandTotal.komisi - grandTotal.kendaraan)}</td>
                  <td style={{ padding:"12px", color:"#10b981", fontWeight:700 }}>{fmtRp(grandTotal.kendaraan)}</td>
                  <td style={{ padding:"12px", color:"#10b981", fontWeight:800, fontSize:15 }}>{fmtRp(grandTotal.komisi)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>

      {editTarget && (
        <KomisiEditModal
          session={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setSessions(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
            setEditTarget(null);
          }}
        />
      )}
    </>
  );
}