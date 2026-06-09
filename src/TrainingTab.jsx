import { useState, useEffect } from "react";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
const TRAIN_API = `${SUPABASE_URL}/rest/v1/training_sessions`;
const TEAM_API  = `${SUPABASE_URL}/rest/v1/team_members`;

function getToken() {
  try { return JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY; }
  catch { return SUPABASE_KEY; }
}

async function getValidToken() {
  try {
    const session = JSON.parse(localStorage.getItem("sb_session"));
    if (!session?.access_token) return SUPABASE_KEY;
    
    // Check if token is close to expiry (decode JWT payload)
    const payload = JSON.parse(atob(session.access_token.split(".")[1]));
    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    
    // If expires within 5 minutes, refresh
    if (expiresAt - now < 5 * 60 * 1000) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (res.ok) {
        const newSession = await res.json();
        localStorage.setItem("sb_session", JSON.stringify(newSession));
        return newSession.access_token;
      }
    }
    return session.access_token;
  } catch { return SUPABASE_KEY; }
}

function hdrs() {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${getToken()}`,
    "Prefer": "return=representation",
  };
}

async function getHdrs() {
  const token = await getValidToken();
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${token}`,
    "Prefer": "return=representation",
  };
}

async function getSessions(projectId) {
  const res = await fetch(`${TRAIN_API}?project_id=eq.${projectId}&order=training_date.desc`, { headers: await getHdrs() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function addSession(session) {
  const res = await fetch(TRAIN_API, { method: "POST", headers: await getHdrs(), body: JSON.stringify(session) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteSession(id) {
  const res = await fetch(`${TRAIN_API}?id=eq.${id}`, { method: "DELETE", headers: await getHdrs() });
  if (!res.ok) throw new Error(await res.text());
}

const INP = { width: "100%", background: "#0c1628", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginTop: 4 };
const MINI = { background: "#0a1525", border: "1px solid #1a2744", borderRadius: 10, padding: 14 };

// ─── EDIT SESSION MODAL ──────────────────────────────────────────────────────
function EditSessionModal({ session, project, teamMembers, currentUser, sessions, onClose, onSave, saving }) {
  const calcHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? Math.round(diff / 60 * 10) / 10 : 0;
  };

  const [form, setForm] = useState({
    training_date: session.training_date,
    session_type: session.session_type || "training",
    person1_name: session.trainer_name || "",
    person1_is_partner: session.is_partner || false,
    person1_vehicle: session.use_vehicle || false,
    has_second_person: session.has_second_person || false,
    person2_name: session.person2_name || "",
    person2_is_partner: session.person2_is_partner || false,
    person2_vehicle: session.person2_vehicle || false,
    topics: session.topic || "",
    participants: session.participants || "",
    start_time: session.start_time || "08:00",
    end_time: session.end_time || "10:00",
    notes: session.notes || "",
  });
  const [err, setErr] = useState("");

  const hoursFromTime = calcHours(form.start_time, form.end_time);

  // Remaining hours excluding this session
  const otherHours = sessions
    .filter(s => s.id !== session.id)
    .reduce((a, s) => a + parseFloat(s.hours_used || 0), 0);
  const remaining = project.trainingHours.total - otherHours;

  const handleSave = async () => {
    if (!form.person1_name || !form.topics || !form.start_time || !form.end_time) {
      setErr("Nama, materi, jam mulai & selesai wajib diisi"); return;
    }
    if (hoursFromTime <= 0) { setErr("Jam selesai harus lebih dari jam mulai"); return; }
    if (hoursFromTime > remaining) { setErr(`Durasi (${hoursFromTime} jam) melebihi sisa kuota (${remaining} jam)`); return; }

    const updated = {
      training_date: form.training_date,
      session_type: form.session_type,
      trainer_name: form.person1_name,
      is_partner: form.session_type === "training" ? form.person1_is_partner : false,
      use_vehicle: form.person1_vehicle,
      has_second_person: form.has_second_person,
      person2_name: form.has_second_person ? form.person2_name : null,
      person2_is_partner: form.has_second_person ? form.person2_is_partner : false,
      person2_vehicle: form.has_second_person ? form.person2_vehicle : false,
      technician_count: form.has_second_person ? 2 : 1,
      topic: form.topics,
      participants: form.participants,
      hours_used: hoursFromTime,
      start_time: form.start_time,
      end_time: form.end_time,
      notes: form.notes,
    };
    await onSave(session.id, updated);
  };

  const INP_S = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"7px 10px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };
  const MINI_S = { background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:12 };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:24, maxWidth:680, width:"100%", maxHeight:"90vh", overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700, color:"#f1f5f9" }}>✏️ Edit Sesi Training</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {err && <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:14, fontSize:12, background:"#1c0a0a", color:"#ef4444", border:"1px solid #ef444433" }}>⚠️ {err}</div>}

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {/* Session type */}
          <div style={{ display:"flex", gap:8 }}>
            {[["training","📚 Training"],["onsite","🔧 Onsite IT"]].map(([v,l])=>(
              <button key={v} onClick={()=>setForm(f=>({...f,session_type:v}))} style={{ flex:1, padding:"9px", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", border:`1px solid ${form.session_type===v?(v==="training"?"#38bdf8":"#10b981"):"#1e293b"}`, background:form.session_type===v?(v==="training"?"#0c2a3f":"#052e16"):"transparent", color:form.session_type===v?(v==="training"?"#38bdf8":"#10b981"):"#475569" }}>{l}</button>
            ))}
          </div>

          {/* Date & Time */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
            <div style={{ gridColumn:"1/2" }}><label style={{ fontSize:11, color:"#64748b" }}>Tanggal</label><input type="date" style={INP_S} value={form.training_date} onChange={e=>setForm(f=>({...f,training_date:e.target.value}))} /></div>
            <div><label style={{ fontSize:11, color:"#64748b" }}>Jam Mulai</label><input type="time" style={INP_S} value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} /></div>
            <div><label style={{ fontSize:11, color:"#64748b" }}>Jam Selesai</label><input type="time" style={INP_S} value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} /></div>
            <div style={{ display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
              <label style={{ fontSize:11, color:"#64748b", marginBottom:4 }}>Durasi</label>
              <div style={{ background:"#060d1a", border:"1px solid #1e293b", borderRadius:8, padding:"7px 10px", fontSize:13, fontWeight:700, color: hoursFromTime > 0 ? "#38bdf8" : "#334155" }}>
                {hoursFromTime > 0 ? `${hoursFromTime} jam` : "—"}
                {hoursFromTime > remaining && <span style={{ fontSize:10, color:"#ef4444", marginLeft:4 }}>melebihi!</span>}
              </div>
            </div>
          </div>

          {/* Person 1 */}
          <div style={MINI_S}>
            <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:8 }}>{form.session_type==="onsite"?"👤 Teknisi 1":"👤 Orang 1"}</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={{ fontSize:11, color:"#64748b" }}>Nama</label>
                {teamMembers.length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:4, marginBottom:4 }}>
                    {teamMembers.slice(0,8).map(m=>(
                      <button key={m.id} type="button" onClick={()=>setForm(f=>({...f,person1_name:m.name}))} style={{ padding:"3px 10px", borderRadius:999, fontSize:11, cursor:"pointer", border:`1px solid ${form.person1_name===m.name?"#38bdf8":"#1e293b"}`, background:form.person1_name===m.name?"#0c2a3f":"transparent", color:form.person1_name===m.name?"#38bdf8":"#475569" }}>{m.name}</button>
                    ))}
                  </div>
                )}
                <input style={INP_S} value={form.person1_name} onChange={e=>setForm(f=>({...f,person1_name:e.target.value}))} placeholder="Nama" />
              </div>
              {form.session_type==="training" && (
                <div style={{ gridColumn:"1/-1" }}>
                  <label style={{ fontSize:11, color:"#64748b" }}>Status</label>
                  <div style={{ display:"flex", gap:6, marginTop:4 }}>
                    {[["internal",false,"🏢 Internal","#38bdf8","#0c2a3f"],["partner",true,"🤝 Partner","#a78bfa","#1e1040"]].map(([k,v,l,c,bg])=>(
                      <button key={k} onClick={()=>setForm(f=>({...f,person1_is_partner:v}))} style={{ flex:1, padding:"6px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.person1_is_partner===v?c:"#1e293b"}`, background:form.person1_is_partner===v?bg:"transparent", color:form.person1_is_partner===v?c:"#475569" }}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ gridColumn:"1/-1", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#060d1a", borderRadius:8, padding:"8px 12px" }}>
                <span style={{ fontSize:12, color:"#64748b" }}>🚗 Kendaraan Pribadi</span>
                <div onClick={()=>setForm(f=>({...f,person1_vehicle:!f.person1_vehicle}))} style={{ width:40, height:22, borderRadius:999, cursor:"pointer", background:form.person1_vehicle?"#10b981":"#1e293b", position:"relative", transition:"background 0.2s" }}>
                  <div style={{ position:"absolute", top:2, left:form.person1_vehicle?20:2, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Person 2 toggle */}
          <button onClick={()=>setForm(f=>({...f,has_second_person:!f.has_second_person,person2_name:"",person2_is_partner:false,person2_vehicle:false}))} style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", border:`1px solid ${form.has_second_person?"#ef444433":"#1e293b"}`, background:form.has_second_person?"#1c0a0a":"transparent", color:form.has_second_person?"#ef4444":"#64748b" }}>
            {form.has_second_person ? "✕ Hapus Orang Kedua" : `+ Tambah ${form.session_type==="onsite"?"Teknisi":"Trainer"} Kedua`}
          </button>

          {/* Person 2 */}
          {form.has_second_person && (
            <div style={{ ...MINI_S, borderColor:"#1d4ed8" }}>
              <div style={{ fontSize:12, fontWeight:600, color:"#38bdf8", marginBottom:8 }}>{form.session_type==="onsite"?"👥 Teknisi 2":"👥 Orang 2"}</div>
              <div>
                {teamMembers.length > 0 && (
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:4 }}>
                    {teamMembers.filter(m=>m.name!==form.person1_name).slice(0,8).map(m=>(
                      <button key={m.id} type="button" onClick={()=>setForm(f=>({...f,person2_name:m.name}))} style={{ padding:"3px 10px", borderRadius:999, fontSize:11, cursor:"pointer", border:`1px solid ${form.person2_name===m.name?"#38bdf8":"#1e293b"}`, background:form.person2_name===m.name?"#0c2a3f":"transparent", color:form.person2_name===m.name?"#38bdf8":"#475569" }}>{m.name}</button>
                    ))}
                  </div>
                )}
                <input style={INP_S} value={form.person2_name} onChange={e=>setForm(f=>({...f,person2_name:e.target.value}))} placeholder="Nama orang kedua" />
                {form.session_type==="training" && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    {[["internal",false,"🏢 Internal","#38bdf8","#0c2a3f"],["partner",true,"🤝 Partner","#a78bfa","#1e1040"]].map(([k,v,l,c,bg])=>(
                      <button key={k} onClick={()=>setForm(f=>({...f,person2_is_partner:v}))} style={{ flex:1, padding:"6px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${form.person2_is_partner===v?c:"#1e293b"}`, background:form.person2_is_partner===v?bg:"transparent", color:form.person2_is_partner===v?c:"#475569" }}>{l}</button>
                    ))}
                  </div>
                )}
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#060d1a", borderRadius:8, padding:"8px 12px", marginTop:8 }}>
                  <span style={{ fontSize:12, color:"#64748b" }}>🚗 Kendaraan Pribadi</span>
                  <div onClick={()=>setForm(f=>({...f,person2_vehicle:!f.person2_vehicle}))} style={{ width:40, height:22, borderRadius:999, cursor:"pointer", background:form.person2_vehicle?"#10b981":"#1e293b", position:"relative", transition:"background 0.2s" }}>
                    <div style={{ position:"absolute", top:2, left:form.person2_vehicle?20:2, width:18, height:18, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Materi & Peserta */}
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Materi / Topik</label>
            <textarea style={{ ...INP_S, resize:"vertical" }} rows={3} value={form.topics} onChange={e=>setForm(f=>({...f,topics:e.target.value}))} placeholder="Materi yang disampaikan..." />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Peserta</label>
            <input style={INP_S} value={form.participants} onChange={e=>setForm(f=>({...f,participants:e.target.value}))} placeholder="Nama peserta, dipisah koma" />
          </div>
          <div>
            <label style={{ fontSize:11, color:"#64748b" }}>Catatan</label>
            <textarea style={{ ...INP_S, resize:"vertical" }} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Catatan tambahan..." />
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

export default function TrainingTab({ project, canEdit, canTraining, canDelete, currentUser, onUpdateHours, onSave }) {
  const [subTab, setSubTab] = useState("histori");
  const [sessions, setSessions] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [editSession, setEditSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    training_date: new Date().toISOString().split("T")[0],
    session_type: "training",
    // Person 1
    person1_name: currentUser?.profile?.full_name || "",
    person1_is_partner: false,
    person1_vehicle: false,
    // Person 2 (optional)
    has_second_person: false,
    person2_name: "",
    person2_is_partner: false,
    person2_vehicle: false,
    // Common
    participants: "",
    topics: "",
    start_time: "08:00",
    end_time: "10:00",
    notes: "",
  });

  // Auto calculate hours from start/end time
  const calcHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return diff > 0 ? Math.round(diff / 60 * 10) / 10 : 0;
  };
  const hoursFromTime = calcHours(form.start_time, form.end_time);

  useEffect(() => { loadSessions(); loadTeam(); }, [project.id]);

  const loadTeam = async () => {
    try {
      const token = await getValidToken();
      const res = await fetch(`${TEAM_API}?order=name.asc&is_active=eq.true`, {
        headers: { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${token}` }
      });
      if (res.ok) setTeamMembers(await res.json());
    } catch {}
  };

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await getSessions(project.id);
      setSessions(data);
    } catch (e) { notify(e.message, "error"); }
    setLoading(false);
  };

  const notify = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  // Auto-create jadwal aktivitas from training session
  const createActivityFromSession = async (session, projectName) => {
    try {
      const token = await getValidToken();
      // Find team member id by name
      const memberMatch = teamMembers.find(m => m.name === session.trainer_name);
      const member2Match = session.has_second_person && session.person2_name
        ? teamMembers.find(m => m.name === session.person2_name)
        : null;

      // Find company by project name
      const compRes = await fetch(
        `${SUPABASE_URL}/rest/v1/companies?name=eq.${encodeURIComponent(projectName)}&limit=1`,
        { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` } }
      );
      const compData = compRes.ok ? await compRes.json() : [];
      const company = compData[0] || null;

      const memberIds = [memberMatch?.id, member2Match?.id].filter(Boolean);
      const memberNames = [session.trainer_name, session.has_second_person ? session.person2_name : null].filter(Boolean);

      const activity = {
        activity_date: session.training_date,
        activity_type: session.session_type === "onsite" ? "onsite" : "training",
        team_member_id: memberMatch?.id || null,
        team_member_name: memberNames.join(", "),
        team_member_ids: memberIds,
        team_member_names: memberNames,
        company_id: company?.id || null,
        company_name: projectName,
        company_status: company?.status || "klien",
        outcome: `${session.session_type === "onsite" ? "Onsite IT" : "Training"} ${session.hours_used} jam — ${session.topic?.split("\n")[0] || ""}`,
        notes: session.notes || "",
        follow_up: "",
        start_time: session.start_time || null,
        end_time: session.end_time || null,
        created_by: session.created_by || null,
      };

      await fetch(`${SUPABASE_URL}/rest/v1/team_activities`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${token}`, "Prefer":"return=representation" },
        body: JSON.stringify(activity),
      });
    } catch(e) {
      console.warn("Auto-create activity failed:", e.message);
    }
  };

  // Check if current user can edit/delete a session
  const canEditSession = (session) => {
    if (canDelete) return true; // Admin can edit all
    // Non-admin can only edit their own sessions
    const userName = currentUser?.profile?.full_name || currentUser?.email || "";
    const userId = currentUser?.id;
    return session.created_by === userId ||
      session.trainer_name === userName ||
      session.person2_name === userName;
  };

  const handleUpdateSession = async (sessionId, updatedData) => {
    setSaving(true);
    try {
      const headers = await getHdrs();
      const res = await fetch(`${TRAIN_API}?id=eq.${sessionId}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify(updatedData),
      });
      if (!res.ok) throw new Error(await res.text());
      // Recalculate hours
      const updatedSessions = sessions.map(s => s.id === sessionId ? { ...s, ...updatedData } : s);
      setSessions(updatedSessions);
      const newUsed = updatedSessions.reduce((a, s) => a + parseFloat(s.hours_used || 0), 0);
      await onUpdateHours(project.trainingHours.total, newUsed);
      await onSave({ ...project, trainingHours: { ...project.trainingHours, used: newUsed } });
      setEditSession(null);
      // Update activity if exists, or create new one
      await createActivityFromSession(
        sessions.find(s => s.id === sessionId) ? { ...sessions.find(s => s.id === sessionId), ...updatedData } : updatedData,
        project.name
      );
      notify("Sesi berhasil diupdate! Jadwal aktivitas juga diperbarui.");
    } catch(e) { notify(e.message, "error"); }
    setSaving(false);
  };

  const totalUsedFromHistory = sessions.reduce((a, s) => a + parseFloat(s.hours_used || 0), 0);

  const handleAdd = async () => {
    if (!form.training_date || !form.person1_name || !form.participants || !form.topics || !form.start_time || !form.end_time) {
      notify("Semua field wajib diisi kecuali catatan", "error"); return;
    }
    if (form.has_second_person && !form.person2_name) {
      notify("Nama orang kedua wajib diisi", "error"); return;
    }
    const hrs = calcHours(form.start_time, form.end_time);
    if (hrs <= 0) { notify("Jam selesai harus lebih dari jam mulai", "error"); return; }
    const remaining = project.trainingHours.total - totalUsedFromHistory;
    if (hrs > remaining) { notify(`Durasi (${hrs} jam) melebihi sisa kuota (${remaining} jam)`, "error"); return; }

    setSaving(true);
    try {
      const newSession = {
        project_id: project.id,
        training_date: form.training_date,
        session_type: form.session_type,
        // Person 1
        trainer_name: form.person1_name,
        is_partner: form.session_type === "training" ? form.person1_is_partner : false,
        use_vehicle: form.person1_vehicle,
        // Person 2
        has_second_person: form.has_second_person,
        person2_name: form.has_second_person ? form.person2_name : null,
        person2_is_partner: form.has_second_person && form.session_type === "training" ? form.person2_is_partner : false,
        person2_vehicle: form.has_second_person ? form.person2_vehicle : false,
        // Common
        technician_count: form.has_second_person ? 2 : 1,
        participants: form.participants,
        topic: form.topics,
        hours_used: hrs,
        start_time: form.start_time,
        end_time: form.end_time,
        notes: form.notes,
        created_by: currentUser?.id || null,
      };
      const [saved] = await addSession(newSession);
      setSessions(prev => [saved, ...prev]);

      // Update project training hours
      const newUsed = totalUsedFromHistory + hrs;
      await onUpdateHours(project.trainingHours.total, newUsed);
      await onSave({ ...project, trainingHours: { ...project.trainingHours, used: newUsed } });

      // Auto-create jadwal aktivitas
      await createActivityFromSession({ ...newSession, id: saved.id }, project.name);

      setForm({ training_date: new Date().toISOString().split("T")[0], session_type: "training", person1_name: currentUser?.profile?.full_name || "", person1_is_partner: false, person1_vehicle: false, has_second_person: false, person2_name: "", person2_is_partner: false, person2_vehicle: false, participants: "", topics: "", start_time: "08:00", end_time: "10:00", notes: "" });
      setShowForm(false);
      notify(`Sesi training berhasil dicatat! ${hrs} jam dikurangi dari kuota. Jadwal aktivitas otomatis ditambahkan.`);
    } catch (e) { notify(e.message, "error"); }
    setSaving(false);
  };

  const handleDelete = async (session) => {
    if (!window.confirm(`Hapus sesi training "${session.topic}" pada ${session.training_date}?`)) return;
    try {
      await deleteSession(session.id);
      setSessions(prev => prev.filter(s => s.id !== session.id));
      // Recalculate used hours
      const newUsed = sessions.filter(s => s.id !== session.id).reduce((a, s) => a + parseFloat(s.hours_used || 0), 0);
      await onUpdateHours(project.trainingHours.total, newUsed);
      await onSave({ ...project, trainingHours: { ...project.trainingHours, used: newUsed } });
      notify("Sesi training dihapus");
    } catch (e) { notify(e.message, "error"); }
  };

  const used = totalUsedFromHistory;
  const total = project.trainingHours.total;
  const remaining = total - used;
  const pct = Math.min(100, Math.round((used / total) * 100));
  const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#10b981";

  return (
    <div>
      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[["histori", "📋 Histori Training"], ["kuota", "⏱ Kelola Kuota"]].map(([t, l]) => (
          <button key={t} onClick={() => setSubTab(t)} style={{
            padding: "6px 16px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: `1px solid ${subTab === t ? "#38bdf8" : "#1e293b"}`,
            background: subTab === t ? "#0c4a6e" : "transparent",
            color: subTab === t ? "#38bdf8" : "#64748b",
          }}>{l}</button>
        ))}
      </div>

      {/* Notification */}
      {msg && (
        <div style={{ background: msg.type === "error" ? "#1c0a0a" : "#052e16", border: `1px solid ${msg.type === "error" ? "#ef444433" : "#10b98133"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: msg.type === "error" ? "#ef4444" : "#10b981" }}>
          {msg.type === "error" ? "⚠️" : "✓"} {msg.text}
        </div>
      )}

      {/* ── HISTORI TAB ── */}
      {subTab === "histori" && (
        <div>
          {/* Summary bar */}
          <div style={{ ...MINI, marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>Pemakaian Jam Training</div>
              <div style={{ fontSize: 12, color: "#475569" }}>{sessions.length} sesi tercatat</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, color: "#64748b" }}>
              <span>{used} jam terpakai</span>
              <span style={{ color: remaining <= 0 ? "#ef4444" : "#475569" }}>{remaining} jam sisa</span>
            </div>
            <div style={{ background: "#0f172a", borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 999, transition: "width 0.6s ease" }} />
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
              {[[remaining, "#38bdf8", "jam tersisa"], [used, "#64748b", "jam terpakai"], [total, "#94a3b8", "total jam"]].map(([v, c, l]) => (
                <div key={l}><div style={{ fontSize: 24, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 11, color: "#475569" }}>{l}</div></div>
              ))}
            </div>
          </div>

          {/* Add session button */}
          {canTraining && (
            <div style={{ marginBottom: 16 }}>
              {!showForm ? (
                <button onClick={() => setShowForm(true)} disabled={remaining <= 0} style={{
                  padding: "9px 20px", borderRadius: 8, border: "none",
                  background: remaining <= 0 ? "#1e293b" : "#1d4ed8",
                  color: remaining <= 0 ? "#334155" : "#fff",
                  cursor: remaining <= 0 ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13,
                }}>
                  {remaining <= 0 ? "⚠️ Kuota Habis" : "+ Catat Sesi Training"}
                </button>
              ) : (
                <div style={{ ...MINI, borderColor: "#1d4ed8" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 14 }}>📝 Catat Sesi Training Baru</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 12 }}>

                    {/* Session type selector */}
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 6 }}>Jenis Sesi *</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[
                          ["training", "📚 Training", "#38bdf8", "#0c2a3f", "Pelatihan penggunaan sistem"],
                          ["onsite", "🔧 Onsite IT", "#10b981", "#052e16", "Kunjungan teknis / support"],
                        ].map(([val, label, color, bg, desc]) => (
                          <button key={val} onClick={() => setForm(f => ({ ...f, session_type: val, is_partner: false }))}
                            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
                              border: `1px solid ${form.session_type === val ? color : "#1e293b"}`,
                              background: form.session_type === val ? bg : "transparent",
                              color: form.session_type === val ? color : "#475569", transition: "all 0.15s", textAlign: "left" }}>
                            <div>{label}</div>
                            <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>{desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tarif info */}
                    <div style={{ background: "#060d1a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#475569" }}>
                      {form.session_type === "training" ? (
                        <span>💰 Tarif: <span style={{ color: "#38bdf8" }}>Internal Rp 100rb/jam</span> · <span style={{ color: "#a78bfa" }}>Partner Rp 150rb/jam</span></span>
                      ) : (
                        <span>💰 Tarif: <span style={{ color: "#10b981" }}>1 Teknisi Rp 100rb/jam</span> · <span style={{ color: "#f59e0b" }}>2 Teknisi Rp 70rb/jam per orang</span></span>
                      )}
                    </div>

                    {/* Row 1: Tanggal */}
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b" }}>{form.session_type === "onsite" ? "Tanggal Onsite *" : "Tanggal Training *"}</label>
                      <input type="date" style={INP} value={form.training_date} onChange={e => setForm(f => ({ ...f, training_date: e.target.value }))} />
                    </div>

                    {/* Person 1 */}
                    <div style={{ background: "#060d1a", border: "1px solid #1e293b", borderRadius: 10, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 10 }}>
                        {form.session_type === "onsite" ? "👤 Teknisi 1 *" : "👤 Trainer / Orang 1 *"}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={{ fontSize: 11, color: "#64748b" }}>Nama * <span style={{ color:"#334155", fontWeight:400 }}>(pilih dari tim atau ketik manual)</span></label>
                          {teamMembers.length > 0 && (
                            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6, marginBottom:6 }}>
                              {teamMembers.map(m => (
                                <button key={m.id} type="button" onClick={() => setForm(f => ({ ...f, person1_name: m.name }))}
                                  style={{ padding:"4px 12px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer",
                                    border:`1px solid ${form.person1_name===m.name?"#38bdf8":"#1e293b"}`,
                                    background:form.person1_name===m.name?"#0c2a3f":"transparent",
                                    color:form.person1_name===m.name?"#38bdf8":"#475569" }}>
                                  {m.name}{m.position ? ` (${m.position})` : ""}
                                </button>
                              ))}
                            </div>
                          )}
                          <input type="text" style={INP} placeholder={form.session_type === "onsite" ? "Nama teknisi" : "Nama trainer/orang pertama"} value={form.person1_name} onChange={e => setForm(f => ({ ...f, person1_name: e.target.value }))} />
                        </div>
                        {form.session_type === "training" && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: 11, color: "#64748b" }}>Status</label>
                            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                              {[["internal", false, "🏢 Internal", "#38bdf8", "#0c2a3f"], ["partner", true, "🤝 Partner", "#a78bfa", "#1e1040"]].map(([key, val, label, color, bg]) => (
                                <button key={key} onClick={() => setForm(f => ({ ...f, person1_is_partner: val }))}
                                  style={{ flex: 1, padding: "6px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                    border: `1px solid ${form.person1_is_partner === val ? color : "#1e293b"}`,
                                    background: form.person1_is_partner === val ? bg : "transparent",
                                    color: form.person1_is_partner === val ? color : "#475569" }}>
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a1525", borderRadius: 8, padding: "8px 12px" }}>
                          <span style={{ fontSize: 12, color: "#64748b" }}>🚗 Kendaraan Pribadi</span>
                          <div onClick={() => setForm(f => ({ ...f, person1_vehicle: !f.person1_vehicle }))} style={{ width: 40, height: 22, borderRadius: 999, cursor: "pointer", background: form.person1_vehicle ? "#10b981" : "#1e293b", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                            <div style={{ position: "absolute", top: 2, left: form.person1_vehicle ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Toggle add second person */}
                    <button onClick={() => setForm(f => ({ ...f, has_second_person: !f.has_second_person, person2_name: "", person2_is_partner: false, person2_vehicle: false }))}
                      style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${form.has_second_person ? "#ef444433" : "#1e293b"}`,
                        background: form.has_second_person ? "#1c0a0a" : "transparent",
                        color: form.has_second_person ? "#ef4444" : "#64748b" }}>
                      {form.has_second_person ? "✕ Hapus Orang Kedua" : `+ Tambah ${form.session_type === "onsite" ? "Teknisi" : "Trainer"} Kedua`}
                    </button>

                    {/* Person 2 */}
                    {form.has_second_person && (
                      <div style={{ background: "#060d1a", border: "1px solid #1d4ed8", borderRadius: 10, padding: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#38bdf8", marginBottom: 10 }}>
                          {form.session_type === "onsite" ? "👥 Teknisi 2 *" : "👥 Trainer / Orang 2 *"}
                          <span style={{ fontSize: 11, fontWeight: 400, color: "#475569", marginLeft: 8 }}>
                            {form.session_type === "onsite" ? "Tarif: Rp 70rb/jam" : 
                             form.person2_is_partner ? "Tarif: Rp 100rb/jam" : "Tarif: Rp 70rb/jam"}
                          </span>
                        </div>
                        <div style={{ display: "grid", gap: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, color: "#64748b" }}>Nama * <span style={{ color:"#334155", fontWeight:400 }}>(pilih atau ketik manual)</span></label>
                            {teamMembers.length > 0 && (
                              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6, marginBottom:6 }}>
                                {teamMembers.filter(m => m.name !== form.person1_name).map(m => (
                                  <button key={m.id} type="button" onClick={() => setForm(f => ({ ...f, person2_name: m.name }))}
                                    style={{ padding:"4px 12px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer",
                                      border:`1px solid ${form.person2_name===m.name?"#38bdf8":"#1e293b"}`,
                                      background:form.person2_name===m.name?"#0c2a3f":"transparent",
                                      color:form.person2_name===m.name?"#38bdf8":"#475569" }}>
                                    {m.name}{m.position ? ` (${m.position})` : ""}
                                  </button>
                                ))}
                              </div>
                            )}
                            <input type="text" style={INP} placeholder={form.session_type === "onsite" ? "Nama teknisi kedua" : "Nama trainer/orang kedua"} value={form.person2_name} onChange={e => setForm(f => ({ ...f, person2_name: e.target.value }))} />
                          </div>
                          {form.session_type === "training" && (
                            <div>
                              <label style={{ fontSize: 11, color: "#64748b" }}>Status</label>
                              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                {[["internal", false, "🏢 Internal", "#38bdf8", "#0c2a3f"], ["partner", true, "🤝 Partner", "#a78bfa", "#1e1040"]].map(([key, val, label, color, bg]) => (
                                  <button key={key} onClick={() => setForm(f => ({ ...f, person2_is_partner: val }))}
                                    style={{ flex: 1, padding: "6px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                                      border: `1px solid ${form.person2_is_partner === val ? color : "#1e293b"}`,
                                      background: form.person2_is_partner === val ? bg : "transparent",
                                      color: form.person2_is_partner === val ? color : "#475569" }}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a1525", borderRadius: 8, padding: "8px 12px" }}>
                            <span style={{ fontSize: 12, color: "#64748b" }}>🚗 Kendaraan Pribadi</span>
                            <div onClick={() => setForm(f => ({ ...f, person2_vehicle: !f.person2_vehicle }))} style={{ width: 40, height: 22, borderRadius: 999, cursor: "pointer", background: form.person2_vehicle ? "#10b981" : "#1e293b", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                              <div style={{ position: "absolute", top: 2, left: form.person2_vehicle ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Row 2: Jam Mulai & Selesai + durasi otomatis */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#64748b" }}>Jam Mulai *</label>
                        <input type="time" style={INP} value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#64748b" }}>Jam Selesai *</label>
                        <input type="time" style={INP} value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                        <label style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>Durasi</label>
                        <div style={{ background: "#060d1a", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 14, fontWeight: 700, color: hoursFromTime > 0 ? "#38bdf8" : "#334155" }}>
                          {hoursFromTime > 0 ? `${hoursFromTime} jam` : "—"}
                          {hoursFromTime > remaining && <span style={{ fontSize: 11, color: "#ef4444", marginLeft: 6 }}>melebihi kuota!</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: -6 }}>
                      Sisa kuota: <span style={{ color: remaining <= 0 ? "#ef4444" : "#f59e0b", fontWeight: 600 }}>{remaining} jam</span>
                    </div>

                    {/* Row 3: Peserta */}
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b" }}>Peserta Training *</label>
                      <input type="text" style={INP} placeholder="Nama peserta, dipisah koma" value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} />
                    </div>

                    {/* Row 4: Materi (textarea banyak baris) */}
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b" }}>Materi / Topik Training *</label>
                      <textarea style={{ ...INP, resize: "vertical", lineHeight: 1.6 }} rows={4}
                        placeholder="Contoh: 1. Modul Penjualan, 2. Modul Pembelian, 3. Laporan Stok"
                        value={form.topics} onChange={e => setForm(f => ({ ...f, topics: e.target.value }))} />
                    </div>

                    {/* Row 5: Kendaraan pribadi toggle */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#060d1a", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 14px" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 600 }}>🚗 Menggunakan Kendaraan Pribadi</div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Trainer menggunakan kendaraan pribadi untuk kunjungan</div>
                      </div>
                      <div onClick={() => setForm(f => ({ ...f, use_vehicle: !f.use_vehicle }))} style={{
                        width: 48, height: 26, borderRadius: 999, cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
                        background: form.use_vehicle ? "#10b981" : "#1e293b", position: "relative",
                      }}>
                        <div style={{ position: "absolute", top: 3, left: form.use_vehicle ? 24 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                      </div>
                    </div>

                    {/* Row 6: Catatan */}
                    <div>
                      <label style={{ fontSize: 11, color: "#64748b" }}>Catatan Tambahan</label>
                      <textarea style={{ ...INP, resize: "vertical" }} rows={2}
                        placeholder="Opsional — kendala, tindak lanjut, dll"
                        value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={handleAdd} disabled={saving} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: saving ? "#1e293b" : "#059669", color: saving ? "#475569" : "#fff", cursor: saving ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 13 }}>
                      {saving ? "Menyimpan..." : "✓ Simpan Sesi"}
                    </button>
                    <button onClick={() => setShowForm(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 13 }}>Batal</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sessions list */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#475569" }}>Memuat histori...</div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", color: "#334155" }}>
              <div style={{ fontSize: 36 }}>📚</div>
              <div style={{ fontSize: 14, marginTop: 10, color: "#475569" }}>Belum ada sesi training tercatat</div>
              {canTraining && <div style={{ fontSize: 12, marginTop: 4 }}>Klik "+ Catat Sesi Training" untuk mulai</div>}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sessions.map(s => (
                <div key={s.id} style={{ ...MINI, borderLeft: "3px solid #1d4ed8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                        {/* Session type badge */}
                        {s.session_type === "onsite"
                          ? <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#052e16", color: "#10b981" }}>🔧 Onsite IT</span>
                          : <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#0c2a3f", color: "#38bdf8" }}>📚 Training</span>
                        }
                        <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "#1a1a2e", color: "#f59e0b" }}>⏱ {s.hours_used} jam</span>
                        {s.start_time && s.end_time && (
                          <span style={{ fontSize: 11, color: "#475569" }}>🕐 {s.start_time} – {s.end_time}</span>
                        )}
                        <span style={{ fontSize: 11, color: "#475569" }}>📅 {s.training_date}</span>
                        {s.session_type === "training" && (s.is_partner
                          ? <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#1e1040", color: "#a78bfa" }}>🤝 Partner</span>
                          : <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#0c2a3f", color: "#38bdf8" }}>🏢 Internal</span>
                        )}
                        {s.session_type === "onsite" && (
                          <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.technician_count === 2 ? "#451a03" : "#052e16", color: s.technician_count === 2 ? "#f59e0b" : "#10b981" }}>
                            {s.technician_count === 2 ? "👥 2 Teknisi" : "👤 1 Teknisi"}
                          </span>
                        )}
                        {(s.use_vehicle || s.person2_vehicle) && (
                          <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#052e16", color: "#10b981" }}>
                            🚗 {[s.use_vehicle && "P1", s.person2_vehicle && "P2"].filter(Boolean).join("+")}
                          </span>
                        )}
                      </div>
                      {/* Details grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          <span style={{ color: "#475569" }}>{s.session_type === "onsite" ? "👤 Teknisi 1: " : "👤 Orang 1: "}</span>
                          {s.trainer_name}
                          {s.session_type === "training" && <span style={{ marginLeft: 4, fontSize: 10, color: s.is_partner ? "#a78bfa" : "#38bdf8" }}>{s.is_partner ? "(Partner)" : "(Internal)"}</span>}
                          {s.use_vehicle && <span style={{ marginLeft: 4, fontSize: 10, color: "#10b981" }}>🚗</span>}
                        </div>
                        {s.has_second_person && s.person2_name && (
                          <div style={{ fontSize: 12, color: "#64748b" }}>
                            <span style={{ color: "#475569" }}>{s.session_type === "onsite" ? "👥 Teknisi 2: " : "👥 Orang 2: "}</span>
                            {s.person2_name}
                            {s.session_type === "training" && <span style={{ marginLeft: 4, fontSize: 10, color: s.person2_is_partner ? "#a78bfa" : "#38bdf8" }}>{s.person2_is_partner ? "(Partner)" : "(Internal)"}</span>}
                            {s.person2_vehicle && <span style={{ marginLeft: 4, fontSize: 10, color: "#10b981" }}>🚗</span>}
                          </div>
                        )}
                        <div style={{ fontSize: 12, color: "#64748b", gridColumn: s.has_second_person ? "1 / -1" : "" }}>
                          <span style={{ color: "#475569" }}>👥 Peserta: </span>{s.participants}
                        </div>
                      </div>
                      {/* Topic - multiline */}
                      <div style={{ background: "#060d1a", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 10px", marginBottom: s.notes ? 8 : 0 }}>
                        <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{s.session_type === "onsite" ? "🔧 Detail Pekerjaan:" : "📚 Materi Training:"}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{s.topic}</div>
                      </div>
                      {s.notes && (
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                          <span style={{ color: "#475569" }}>📝 </span>{s.notes}
                        </div>
                      )}
                    </div>
                    {/* Edit & Delete buttons based on ownership */}
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      {canEditSession(s) && (
                        <button onClick={() => setEditSession(s)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #1d4ed8", background: "#0c1628", color: "#38bdf8", cursor: "pointer", fontSize: 11 }}>✏️</button>
                      )}
                      {(canDelete || canEditSession(s)) && (
                        <button onClick={() => handleDelete(s)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #7f1d1d", background: "#1c0a0a", color: "#ef4444", cursor: "pointer", fontSize: 11 }}>🗑</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── KUOTA TAB ── */}
      {subTab === "kuota" && (
        <div>
          {canEdit ? (
            <>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
                ⚠️ Edit kuota di sini hanya untuk koreksi manual. Pemakaian jam otomatis dihitung dari histori sesi training.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={MINI}>
                  <label style={{ fontSize: 11, color: "#64748b" }}>Total Jam Kontrak</label>
                  <input type="number" style={INP} value={project.trainingHours.total}
                    onChange={e => onUpdateHours(+e.target.value, project.trainingHours.used)} />
                </div>
                <div style={MINI}>
                  <label style={{ fontSize: 11, color: "#64748b" }}>Jam Terpakai (otomatis dari histori)</label>
                  <input type="number" style={{ ...INP, color: "#475569" }} value={used} readOnly />
                </div>
              </div>
              <div style={{ ...MINI, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, color: "#64748b" }}>
                  <span>{used} terpakai dari {total} jam</span>
                  <span style={{ color: remaining <= 0 ? "#ef4444" : "#475569" }}>{remaining} sisa</span>
                </div>
                <div style={{ background: "#0f172a", borderRadius: 999, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 999 }} />
                </div>
              </div>
              <button onClick={() => onSave({ ...project, trainingHours: { total: project.trainingHours.total, used } })}
                style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
                Simpan Kuota
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#334155" }}>
              <div style={{ fontSize: 32 }}>🔒</div>
              <div style={{ fontSize: 14, marginTop: 10, color: "#475569" }}>Hanya Admin & Editor yang bisa mengubah kuota</div>
            </div>
          )}
        </div>
      )}
    </div>

      {/* Edit Session Modal */}
      {editSession && (
        <EditSessionModal
          session={editSession}
          project={project}
          teamMembers={teamMembers}
          currentUser={currentUser}
          sessions={sessions}
          onClose={() => setEditSession(null)}
          onSave={handleUpdateSession}
          saving={saving}
        />
      )}
  );
}