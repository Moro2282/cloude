import { useState, useEffect } from "react";
import { ActivityFormModal } from "./ActivityPage";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";

function getToken() {
  try { return JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY; }
  catch { return SUPABASE_KEY; }
}
function hdrs() {
  return { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${getToken()}` };
}
async function dbGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers: hdrs() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getDaysRemaining(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24));
}

function fmtDate(d) {
  if (!d) return "-";
  const [y, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}

function toYMD(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

// ─── EVENT CONFIG ─────────────────────────────────────────────────────────────
const EVENT_CONFIG = {
  activity:        { color:"#a78bfa", bg:"#1e1040", dot:"#a78bfa", label:"Jadwal Aktivitas" },
  training:        { color:"#38bdf8", bg:"#0c2a3f", dot:"#38bdf8", label:"Sesi Layanan" },
  support_warning: { color:"#f59e0b", bg:"#451a03", dot:"#f59e0b", label:"Support Hampir Habis" },
  support_expired: { color:"#ef4444", bg:"#450a0a", dot:"#ef4444", label:"Support Expired" },
  server_warning:  { color:"#fb923c", bg:"#431407", dot:"#fb923c", label:"Server Hampir Habis" },
  server_expired:  { color:"#ef4444", bg:"#450a0a", dot:"#ef4444", label:"Server Expired" },
};

const ACT_ICONS = { presentasi:"📊", meeting:"🤝", onsite:"🔧", training:"📚" };

// ─── BUILD EVENTS FROM DATA ───────────────────────────────────────────────────
function buildEvents(activities, trainingSessions, projects) {
  const events = [];

  // Jadwal Aktivitas
  activities.forEach(a => {
    if (!a.activity_date) return;
    events.push({
      id: `act-${a.id}`,
      date: a.activity_date,
      type: "activity",
      title: `${ACT_ICONS[a.activity_type]||"📋"} ${a.company_name}`,
      subtitle: `${a.team_member_name} · ${a.start_time||""}${a.end_time?`–${a.end_time}`:""}`,
      detail: a,
      color: EVENT_CONFIG.activity.color,
      bg: EVENT_CONFIG.activity.bg,
    });
  });

  // Sesi Layanan
  trainingSessions.forEach(s => {
    if (!s.training_date) return;
    events.push({
      id: `train-${s.id}`,
      date: s.training_date,
      type: "training",
      title: `${s.session_type==="onsite"?"🔧":"📚"} ${s.trainer_name}`,
      subtitle: `${s.projects?.name||""} · ${s.hours_used} jam`,
      detail: s,
      color: EVENT_CONFIG.training.color,
      bg: EVENT_CONFIG.training.bg,
    });
  });

  // Free Support & Server dari projects
  const today = new Date();
  projects.forEach(p => {
    // Free Support
    if (p.freeSupport?.endDate) {
      const d = getDaysRemaining(p.freeSupport.endDate);
      if (d !== null && d <= 90) {
        const type = d <= 0 ? "support_expired" : "support_warning";
        events.push({
          id: `sup-${p.id}`,
          date: p.freeSupport.endDate,
          type,
          title: `🛡 ${p.name}`,
          subtitle: d <= 0 ? "Free Support EXPIRED" : `Free Support habis ${d} hari lagi`,
          detail: p,
          color: EVENT_CONFIG[type].color,
          bg: EVENT_CONFIG[type].bg,
        });
      }
    }
    // Server
    if (p.server?.active && p.server?.endDate) {
      const d = getDaysRemaining(p.server.endDate);
      if (d !== null && d <= 90) {
        const type = d <= 0 ? "server_expired" : "server_warning";
        events.push({
          id: `svr-${p.id}`,
          date: p.server.endDate,
          type,
          title: `🖥 ${p.name}`,
          subtitle: d <= 0 ? "Server EXPIRED" : `Server habis ${d} hari lagi`,
          detail: p,
          color: EVENT_CONFIG[type].color,
          bg: EVENT_CONFIG[type].bg,
        });
      }
    }
  });

  return events.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── EVENT DETAIL MODAL ───────────────────────────────────────────────────────
function EventDetailModal({ event, onClose }) {
  const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.activity;
  const d = event.detail;
  return (
    <div style={{ position:"fixed", inset:0, background:"#00000099", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:`1px solid ${cfg.color}44`, borderRadius:16, padding:24, maxWidth:440, width:"100%", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ padding:"3px 10px", borderRadius:999, fontSize:11, fontWeight:700, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>
            <span style={{ fontSize:12, color:"#475569" }}>📅 {fmtDate(event.date)}</span>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ fontSize:16, fontWeight:700, color:"#f1f5f9", marginBottom:14 }}>{event.title}</div>

        {event.type === "activity" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[["👤 Tim", d.team_member_name],["🏢 Perusahaan", d.company_name],d.start_time?["🕐 Waktu", `${d.start_time}${d.end_time?`–${d.end_time}`:""}`]:null,["✅ Outcome", d.outcome||"-"],d.follow_up?["🔄 Follow-up", d.follow_up]:null].filter(Boolean).map(([l,v])=>(
              <div key={l} style={{ background:"#0a1525", borderRadius:8, padding:"8px 12px" }}>
                <div style={{ fontSize:10, color:"#475569" }}>{l}</div>
                <div style={{ fontSize:13, color:"#e2e8f0", marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {event.type === "training" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[["👤 Trainer", d.trainer_name],["🏢 Proyek", d.projects?.name||"-"],["⏱ Durasi", `${d.hours_used} jam`],d.start_time?["🕐 Waktu", `${d.start_time}${d.end_time?`–${d.end_time}`:""}`]:null,["📚 Materi", d.topic||"-"]].filter(Boolean).map(([l,v])=>(
              <div key={l} style={{ background:"#0a1525", borderRadius:8, padding:"8px 12px" }}>
                <div style={{ fontSize:10, color:"#475569" }}>{l}</div>
                <div style={{ fontSize:13, color:"#e2e8f0", marginTop:2, whiteSpace:"pre-wrap" }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {(event.type.includes("support") || event.type.includes("server")) && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {[["🏢 Proyek", d.name],["👤 Klien", d.client],event.type.includes("support")?["📅 Berakhir", fmtDate(d.freeSupport?.endDate)]:["📅 Berakhir", fmtDate(d.server?.endDate)],["⏳ Sisa", (() => { const days = getDaysRemaining(event.date); return days <= 0 ? "SUDAH EXPIRED" : `${days} hari lagi`; })()]].map(([l,v])=>(
              <div key={l} style={{ background:"#0a1525", borderRadius:8, padding:"8px 12px" }}>
                <div style={{ fontSize:10, color:"#475569" }}>{l}</div>
                <div style={{ fontSize:13, color: l==="⏳ Sisa" ? cfg.color : "#e2e8f0", fontWeight: l==="⏳ Sisa"?700:400, marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MONTH VIEW ───────────────────────────────────────────────────────────────
function MonthView({ year, month, eventsByDate, onDayClick, selectedDate }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toYMD(new Date());
  const days = [];
  // Padding before
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const DAY_NAMES = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

  return (
    <div>
      {/* Day headers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color:"#334155", padding:"6px 0" }}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {days.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const dayEvents = eventsByDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasExpired = dayEvents.some(e => e.type.includes("expired"));
          const hasWarning = dayEvents.some(e => e.type.includes("warning") || e.type==="activity" || e.type==="training");

          return (
            <div key={day} onClick={() => onDayClick(dateStr)} style={{
              minHeight:72, padding:"6px 4px", borderRadius:8, cursor: dayEvents.length ? "pointer" : "default",
              background: isSelected ? "#0c2a3f" : isToday ? "#0f172a" : "transparent",
              border: `1px solid ${isSelected ? "#38bdf8" : isToday ? "#1d4ed8" : "#1a2744"}`,
              transition: "background 0.15s",
            }}
              onMouseEnter={e=>{ if(!isSelected) e.currentTarget.style.background="#0a1525"; }}
              onMouseLeave={e=>{ if(!isSelected) e.currentTarget.style.background=isToday?"#0f172a":"transparent"; }}>
              <div style={{ fontSize:12, fontWeight: isToday?800:500, color: isToday?"#38bdf8":isSelected?"#38bdf8":"#64748b", marginBottom:4, textAlign:"center" }}>{day}</div>
              {/* Event dots */}
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                {dayEvents.slice(0,3).map(ev => (
                  <div key={ev.id} style={{ fontSize:10, padding:"2px 4px", borderRadius:4, background:ev.bg, color:ev.color, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && <div style={{ fontSize:10, color:"#475569", textAlign:"center" }}>+{dayEvents.length-3} lagi</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AGENDA VIEW ──────────────────────────────────────────────────────────────
function AgendaView({ events, onEventClick }) {
  if (events.length === 0) return (
    <div style={{ textAlign:"center", padding:"60px 20px", color:"#334155" }}>
      <div style={{ fontSize:40 }}>📭</div>
      <div style={{ fontSize:15, marginTop:12 }}>Tidak ada event di periode ini</div>
    </div>
  );

  // Group by date
  const grouped = {};
  events.forEach(ev => {
    if (!grouped[ev.date]) grouped[ev.date] = [];
    grouped[ev.date].push(ev);
  });

  const todayStr = toYMD(new Date());

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([date, dayEvents]) => {
        const isToday = date === todayStr;
        const isPast = date < todayStr;
        return (
          <div key={date}>
            {/* Date header */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <div style={{ padding:"4px 14px", borderRadius:999, fontSize:12, fontWeight:700,
                background: isToday?"#1d4ed8":isPast?"#0f172a":"#0a1525",
                color: isToday?"#fff":isPast?"#334155":"#94a3b8",
                border: `1px solid ${isToday?"#1d4ed8":"#1a2744"}` }}>
                {isToday ? "🔵 Hari Ini" : ""} {fmtDate(date)}
              </div>
              <div style={{ flex:1, height:1, background:"#1a2744" }} />
              <span style={{ fontSize:11, color:"#334155" }}>{dayEvents.length} event</span>
            </div>
            {/* Events */}
            <div style={{ display:"flex", flexDirection:"column", gap:8, paddingLeft:8 }}>
              {dayEvents.map(ev => {
                const cfg = EVENT_CONFIG[ev.type];
                return (
                  <div key={ev.id} onClick={()=>onEventClick(ev)} style={{ display:"flex", gap:12, alignItems:"center", padding:"10px 14px", background:"#0a1525", border:`1px solid ${cfg.color}33`, borderLeft:`3px solid ${cfg.color}`, borderRadius:"0 10px 10px 0", cursor:"pointer", transition:"background 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="#0c1628"}
                    onMouseLeave={e=>e.currentTarget.style.background="#0a1525"}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", marginBottom:2 }}>{ev.title}</div>
                      <div style={{ fontSize:11, color:"#475569" }}>{ev.subtitle}</div>
                    </div>
                    <span style={{ padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700, background:cfg.bg, color:cfg.color, flexShrink:0 }}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CalendarPage({ onClose, projects, currentUser }) {
  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(null);
  const [members, setMembers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activities, setActivities] = useState([]);
  const [trainingSessions, setTrainingSessions] = useState([]);

  // Filters
  const [showActivity, setShowActivity] = useState(true);
  const [showTraining, setShowTraining] = useState(true);
  const [showSupport, setShowSupport] = useState(true);
  const [showServer, setShowServer] = useState(true);

  useEffect(() => {
    loadAll();
    // Load members and companies for form
    Promise.all([
      dbGet("team_members","?order=name.asc&is_active=eq.true"),
      dbGet("companies","?order=name.asc"),
    ]).then(([m,c])=>{ setMembers(m||[]); setCompanies(c||[]); }).catch(()=>{});
  }, []);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      dbGet("team_activities", "?order=activity_date.asc"),
      dbGet("training_sessions", "?select=*,projects(name,client)&order=training_date.asc"),
    ]).then(([acts, trains]) => {
      setActivities(acts);
      setTrainingSessions(trains);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  const handleSaveActivity = async (payload, id) => {
    const H = {...hdrs(),"Content-Type":"application/json","Prefer":"return=representation"};
    if (id) {
      await fetch(`${SUPABASE_URL}/rest/v1/team_activities?id=eq.${id}`,{method:"PATCH",headers:H,body:JSON.stringify(payload)});
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/team_activities`,{method:"POST",headers:H,body:JSON.stringify(payload)});
    }
    loadAll();
    setShowForm(false);
    setFormDate(null);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

  // Build all events
  const allEvents = buildEvents(activities, trainingSessions, projects);

  // Apply filters
  const filteredEvents = allEvents.filter(ev => {
    if (!showActivity && ev.type === "activity") return false;
    if (!showTraining && ev.type === "training") return false;
    if (!showSupport && (ev.type === "support_warning" || ev.type === "support_expired")) return false;
    if (!showServer && (ev.type === "server_warning" || ev.type === "server_expired")) return false;
    return true;
  });

  // Filter by current month for month view
  const monthPrefix = `${year}-${String(month+1).padStart(2,"0")}`;
  const monthEvents = view === "month"
    ? filteredEvents.filter(ev => ev.date.startsWith(monthPrefix))
    : filteredEvents;

  // Group by date for month view
  const eventsByDate = {};
  monthEvents.forEach(ev => {
    if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
    eventsByDate[ev.date].push(ev);
  });

  const handleDayClick = (dateStr) => {
    const dayEvs = eventsByDate[dateStr] || [];
    if (dayEvs.length === 0) return;
    setSelectedDate(dateStr);
    setSelectedDayEvents(dayEvs);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Stats
  const upcomingCount = filteredEvents.filter(e => e.date >= toYMD(new Date())).length;
  const expiredCount = filteredEvents.filter(e => e.type.includes("expired")).length;
  const warningCount = filteredEvents.filter(e => e.type.includes("warning")).length;

  const FilterChip = ({ active, onClick, color, label }) => (
    <button onClick={onClick} style={{ padding:"5px 12px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer", border:`1px solid ${active?color:"#1e293b"}`, background:active?"#0c1628":"transparent", color:active?color:"#475569", transition:"all 0.15s" }}>
      {active ? "✓ " : ""}{label}
    </button>
  );

  return (
    <>
    <div style={{ position:"fixed", inset:0, background:"#060d1a", zIndex:2000, overflowY:"auto", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24, flexWrap:"wrap", gap:16 }}>
          <div>
            <button onClick={onClose} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, marginBottom:8, padding:0, display:"flex", alignItems:"center", gap:6 }}>← Kembali ke Dashboard</button>
            <h1 style={{ fontSize:28, fontWeight:900, color:"#f1f5f9", margin:0 }}>🗓 Kalender</h1>
            <div style={{ fontSize:13, color:"#475569", marginTop:4 }}>{upcomingCount} event mendatang · {warningCount} peringatan · {expiredCount} expired</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={()=>{ setFormDate(null); setShowForm(true); }} style={{ padding:"9px 18px", borderRadius:10, border:"none", background:"#1d4ed8", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:700 }}>
              + Buat Jadwal
            </button>
            {[["month","📅 Bulan"],["agenda","📋 Agenda"]].map(([v,l])=>(
              <button key={v} onClick={()=>{ setView(v); setSelectedDate(null); }} style={{ padding:"9px 18px", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", border:`1px solid ${view===v?"#38bdf8":"#1e293b"}`, background:view===v?"#0c4a6e":"#0a1525", color:view===v?"#38bdf8":"#475569" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
          {[
            ["📅 Total Event",  filteredEvents.length, "#38bdf8", "Semua jadwal, sesi & kontrak aktif bulan ini"],
            ["🔜 Mendatang",    upcomingCount,          "#a78bfa", "Event dalam 30 hari ke depan"],
            ["⚠️ Hampir Habis", warningCount,           "#f59e0b", "Free support / server ≤ 30 hari lagi"],
            ["🔴 Expired",      expiredCount,           "#ef4444", "Free support / server sudah berakhir"],
          ].map(([l,v,c,desc])=>(
            <div key={l} title={desc} style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:12, padding:"12px 16px", cursor:"default" }}>
              <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:"#475569" }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background:"#0a1525", border:"1px solid #1a2744", borderRadius:12, padding:"12px 16px", marginBottom:20, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:11, color:"#475569", marginRight:4 }}>Filter:</span>
          <FilterChip active={showActivity} onClick={()=>setShowActivity(!showActivity)} color="#a78bfa" label="Jadwal Aktivitas" />
          <FilterChip active={showTraining} onClick={()=>setShowTraining(!showTraining)} color="#38bdf8" label="Sesi Layanan" />
          <FilterChip active={showSupport} onClick={()=>setShowSupport(!showSupport)} color="#f59e0b" label="Free Support" />
          <FilterChip active={showServer} onClick={()=>setShowServer(!showServer)} color="#fb923c" label="Server" />
          <div style={{ marginLeft:"auto", display:"flex", gap:6 }}>
            {/* Legend */}
            {Object.entries(EVENT_CONFIG).map(([k,v])=>(
              <span key={k} style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, color:"#475569" }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:v.dot, flexShrink:0 }} />{v.label.split(" ")[0]}
              </span>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:"#475569" }}>Memuat data kalender...</div>
        ) : view === "month" ? (
          <div style={{ display:"grid", gridTemplateColumns: selectedDate ? "1fr 320px" : "1fr", gap:20 }}>
            {/* Calendar */}
            <div style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:16, padding:20 }}>
              {/* Month nav */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <button onClick={prevMonth} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:16 }}>‹</button>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontSize:18, fontWeight:800, color:"#f1f5f9" }}>{MONTHS[month]} {year}</span>
                  <button onClick={goToday} style={{ padding:"4px 12px", borderRadius:999, fontSize:11, border:"1px solid #1d4ed8", background:"transparent", color:"#38bdf8", cursor:"pointer" }}>Hari Ini</button>
                </div>
                <button onClick={nextMonth} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:16 }}>›</button>
              </div>
              <MonthView year={year} month={month} eventsByDate={eventsByDate} onDayClick={handleDayClick} selectedDate={selectedDate} />
              {/* Month summary */}
              <div style={{ marginTop:16, paddingTop:12, borderTop:"1px solid #1a2744", fontSize:11, color:"#334155" }}>
                {monthEvents.length} event di {MONTHS[month]}
              </div>
            </div>

            {/* Day detail panel */}
            {selectedDate && (
              <div style={{ background:"#0c1628", border:"1px solid #38bdf8", borderRadius:16, padding:20, height:"fit-content" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#38bdf8" }}>📅 {fmtDate(selectedDate)}</div>
                  <button onClick={()=>setSelectedDate(null)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:16 }}>✕</button>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {selectedDayEvents.map(ev => {
                    const cfg = EVENT_CONFIG[ev.type];
                    return (
                      <div key={ev.id} onClick={()=>setSelectedEvent(ev)} style={{ padding:"10px 12px", background:"#0a1525", border:`1px solid ${cfg.color}33`, borderLeft:`3px solid ${cfg.color}`, borderRadius:"0 8px 8px 0", cursor:"pointer" }}
                        onMouseEnter={e=>e.currentTarget.style.background="#0f172a"}
                        onMouseLeave={e=>e.currentTarget.style.background="#0a1525"}>
                        <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>{ev.title}</div>
                        <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{ev.subtitle}</div>
                        <span style={{ marginTop:4, display:"inline-block", padding:"1px 7px", borderRadius:999, fontSize:10, fontWeight:600, background:cfg.bg, color:cfg.color }}>{cfg.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Agenda View */
          <div>
            {/* Month nav for agenda */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, background:"#0c1628", border:"1px solid #1a2744", borderRadius:12, padding:"12px 20px" }}>
              <button onClick={prevMonth} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:"#64748b", cursor:"pointer" }}>‹ Sebelumnya</button>
              <span style={{ fontSize:16, fontWeight:700, color:"#f1f5f9" }}>{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} style={{ padding:"6px 14px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:"#64748b", cursor:"pointer" }}>Berikutnya ›</button>
            </div>
            <AgendaView events={monthEvents} onEventClick={setSelectedEvent} />
          </div>
        )}
      </div>
      </div>

      {selectedEvent && <EventDetailModal event={selectedEvent} onClose={()=>setSelectedEvent(null)} />}

      {/* ActivityFormModal */}
      {showForm && members.length > 0 && (
        <ActivityFormModal
          activity={formDate ? { activity_date: formDate } : null}
          members={members}
          companies={companies}
          currentUser={currentUser}
          onClose={()=>{ setShowForm(false); setFormDate(null); }}
          onSave={handleSaveActivity}
        />
      )}
    </>
  );
}
