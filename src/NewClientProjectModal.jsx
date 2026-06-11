import { useState } from "react";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"8px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };
const MINI = { background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:14 };

export default function NewClientProjectModal({ company, onClose, onCreated }) {
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

  const durationMonths = () => {
    try {
      return Math.round((new Date(form.supportEnd) - new Date(form.startDate)) / (1000*60*60*24*30));
    } catch { return 0; }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { setErr("Nama proyek wajib diisi"); return; }
    setSaving(true);
    try {
      const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY;
      // Cek duplikat nama proyek
      const chk = await fetch(`${SUPABASE_URL}/rest/v1/projects?name=ilike.${encodeURIComponent(form.name.trim())}&select=id,name`, { headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${token}`} });
      if (chk.ok) {
        const existing = await chk.json();
        if (existing.length > 0) { setErr(`Nama proyek "${existing[0].name}" sudah ada!`); setSaving(false); return; }
      }
      // Use DB column names (matching toRow in App.jsx)
      const newProject = {
        id: "proj-" + Date.now(),
        name: form.name.trim(),
        client: form.client,
        client_email: form.clientEmail,
        start_date: form.startDate,
        training_hours_total: parseInt(form.trainTotal)||40,
        training_hours_used: 0,
        invoice_designs_total: parseInt(form.invTotal)||10,
        invoice_designs_used: 0,
        support_start_date: form.startDate,
        support_end_date: form.supportEnd,
        support_renewals: 0,
        server_active: form.serverActive,
        server_start_date: form.serverActive ? form.serverStart : "",
        server_end_date: form.serverActive ? form.serverEnd : "",
        server_notes: form.serverNotes,
        stages: [
          {id:1,name:"Analisis Kebutuhan",status:"pending",notes:"",date:""},
          {id:2,name:"Setup & Instalasi",status:"pending",notes:"",date:""},
          {id:3,name:"Training Tim",status:"pending",notes:"",date:""},
          {id:4,name:"Uji Coba (UAT)",status:"pending",notes:"",date:""},
          {id:5,name:"Go Live",status:"pending",notes:"",date:""},
          {id:6,name:"Post-Implementation Review",status:"pending",notes:"",date:""},
        ],
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${token}`, "Prefer":"return=representation" },
        body: JSON.stringify(newProject),
      });
      if (!res.ok) throw new Error(await res.text());
      if (onCreated) onCreated(form.name.trim());
    } catch(e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:5000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #10b981", borderRadius:16, padding:28, maxWidth:600, width:"100%", maxHeight:"90vh", overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }} onClick={e=>e.stopPropagation()}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:17, fontWeight:700, color:"#f1f5f9" }}>🎉 Perusahaan Baru Menjadi Klien!</div>
            <div style={{ fontSize:12, color:"#10b981", marginTop:4 }}>Lengkapi info proyek untuk <strong>{company.name}</strong></div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {err && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:14, fontSize:12, background:"#1c0a0a", color:"#ef4444" }}>⚠️ {err}</div>}

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {/* Info Proyek */}
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

          {/* Layanan & Faktur */}
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
            <div style={{ fontSize:11, color:"#475569", marginTop:8 }}>Durasi: {durationMonths()} bulan</div>
          </div>

          {/* Server */}
          <div style={MINI}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: form.serverActive ? 10 : 0 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#64748b" }}>🖥 Server / Hosting</div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:form.serverActive?"#38bdf8":"#475569" }}>{form.serverActive?"Aktif":"Tidak Aktif"}</span>
                <div onClick={()=>setForm(f=>({...f,serverActive:!f.serverActive}))} style={{ width:40,height:22,borderRadius:999,cursor:"pointer",background:form.serverActive?"#38bdf8":"#1e293b",position:"relative",transition:"background 0.2s" }}>
                  <div style={{ position:"absolute",top:2,left:form.serverActive?20:2,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }} />
                </div>
              </div>
            </div>
            {form.serverActive && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
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
          <div style={{ fontSize:11, color:"#334155", textAlign:"center" }}>Klik "Nanti" untuk buat proyek manual dari Dashboard</div>
        </div>
      </div>
    </div>
  );
}
