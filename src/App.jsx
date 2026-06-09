import { useState, useEffect, useCallback } from "react";
import LoginPage from "./LoginPage";
import UserManager from "./UserManager";
import TrainingTab from "./TrainingTab";
import KomisiPage from "./KomisiPage";
import ProfileMenu from "./ProfileMenu";
import ActivityPage from "./ActivityPage";
import MasterDataPage from "./MasterDataPage";
import CalendarPage from "./CalendarPage";
import RoleManagerPage from "./RoleManagerPage";
import { getCurrentUser, signOut, handleOAuthCallback, refreshSession } from "./auth";
import * as XLSX from "xlsx";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
const API = `${SUPABASE_URL}/rest/v1/projects`;
const TRAIN_API = `${SUPABASE_URL}/rest/v1/training_sessions`;
const HEADERS = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  "Prefer": "return=representation",
};

// ─── TRAINING SESSION DB ──────────────────────────────────────────────────────
async function dbGetTrainingSessions(projectId) {
  const res = await fetch(`${TRAIN_API}?project_id=eq.${projectId}&order=training_date.desc`, {
    headers: { ...HEADERS, "Authorization": `Bearer ${getAuthHeaders()["Authorization"]?.split(" ")[1] || SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbAddTrainingSession(session) {
  const res = await fetch(TRAIN_API, {
    method: "POST",
    headers: { ...HEADERS, "Authorization": `Bearer ${getAuthHeaders()["Authorization"]?.split(" ")[1] || SUPABASE_KEY}` },
    body: JSON.stringify(session),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbDeleteTrainingSession(id) {
  const res = await fetch(`${TRAIN_API}?id=eq.${id}`, {
    method: "DELETE",
    headers: { ...HEADERS, "Authorization": `Bearer ${getAuthHeaders()["Authorization"]?.split(" ")[1] || SUPABASE_KEY}` }
  });
  if (!res.ok) throw new Error(await res.text());
}

function getAuthHeaders() {
  try {
    const s = JSON.parse(localStorage.getItem("sb_session"));
    return s ? { "Authorization": `Bearer ${s.access_token}` } : {};
  } catch { return {}; }
}

// ─── SUPABASE HELPERS ─────────────────────────────────────────────────────────

function toRow(p) {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    client_email: p.clientEmail,
    start_date: p.startDate,
    training_hours_total: p.trainingHours.total,
    training_hours_used: p.trainingHours.used,
    invoice_designs_total: p.invoiceDesigns.total,
    invoice_designs_used: p.invoiceDesigns.used,
    support_start_date: p.freeSupport.startDate,
    support_end_date: p.freeSupport.endDate,
    support_renewals: p.freeSupport.renewals,
    stages: p.implementation.stages,
    server_active: p.server.active,
    server_start_date: p.server.startDate,
    server_end_date: p.server.endDate,
    server_notes: p.server.notes,
  };
}

function fromRow(r) {
  return {
    id: r.id,
    name: r.name,
    client: r.client,
    clientEmail: r.client_email || "",
    startDate: r.start_date || "",
    trainingHours: { total: r.training_hours_total, used: r.training_hours_used },
    invoiceDesigns: { total: r.invoice_designs_total, used: r.invoice_designs_used },
    freeSupport: {
      startDate: r.support_start_date || "",
      endDate: r.support_end_date || "",
      renewals: r.support_renewals || 0,
    },
    implementation: { stages: r.stages || [] },
    server: {
      active: r.server_active || false,
      startDate: r.server_start_date || "",
      endDate: r.server_end_date || "",
      notes: r.server_notes || "",
    },
  };
}

async function dbGetAll() {
  const res = await fetch(`${API}?order=created_at.asc`, { headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows.map(fromRow);
}

async function dbUpsert(project) {
  const res = await fetch(`${API}?on_conflict=id`, {
    method: "POST",
    headers: { ...HEADERS, "Prefer": "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(toRow(project)),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function dbDelete(id) {
  const res = await fetch(`${API}?id=eq.${id}`, { method: "DELETE", headers: HEADERS });
  if (!res.ok) throw new Error(await res.text());
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getDaysRemaining(endDate) {
  return Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
}

function badgeStyle(bg, color, border = "none") {
  return { padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color, border, whiteSpace: "nowrap" };
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────

function SupportBadge({ days }) {
  if (days <= 0) return <span style={badgeStyle("#450a0a","#ef4444","1px solid #ef444455")}>Expired</span>;
  if (days <= 30) return <span style={badgeStyle("#450a0a","#ef4444")}>{days} hari lagi</span>;
  if (days <= 90) return <span style={badgeStyle("#451a03","#f59e0b")}>{days} hari lagi</span>;
  return <span style={badgeStyle("#052e16","#10b981")}>{days} hari lagi</span>;
}

function ProgressBar({ value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : color || "#10b981";
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, color: "#64748b" }}>
        <span>{value} terpakai</span>
        <span style={{ color: (max - value) <= 0 ? "#ef4444" : "#475569" }}>{max - value} sisa</span>
      </div>
      <div style={{ background: "#0f172a", borderRadius: 999, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 999, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function StageIndicator({ stages }) {
  const statusColor = { done: "#10b981", "in-progress": "#f59e0b", pending: "#1e293b" };
  const progress = stages.filter(s => s.status === "done").length;
  const current = stages.find(s => s.status === "in-progress") || stages.find(s => s.status === "pending");
  return (
    <div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 8 }}>
        {stages.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <div title={s.name} style={{ width: 26, height: 26, borderRadius: "50%", background: statusColor[s.status], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 800, flexShrink: 0, border: s.status === "in-progress" ? "2px solid #fcd34d" : "2px solid transparent", boxShadow: s.status === "in-progress" ? "0 0 10px #f59e0b66" : "none" }}>
              {s.status === "done" ? "✓" : "·"}
            </div>
            {i < stages.length - 1 && <div style={{ width: 12, height: 2, background: s.status === "done" ? "#10b981" : "#0f172a", flexShrink: 0 }} />}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "#475569" }}>
        {progress}/{stages.length} tahap selesai
        {current && <span style={{ color: "#f59e0b", marginLeft: 6 }}>• {current.name}</span>}
      </div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 28, maxWidth: wide ? 900 : 700, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const INP = { width: "100%", background: "#0c1628", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 14, marginTop: 4, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const MINI = { background: "#0a1525", border: "1px solid #1a2744", borderRadius: 10, padding: 14 };
const BTN = { padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 };

// ─── PROJECT CARD ─────────────────────────────────────────────────────────────

function ProjectCard({ project, onSelect }) {
  const daysLeft = getDaysRemaining(project.freeSupport.endDate);
  const trainPct = Math.round((project.trainingHours.used / project.trainingHours.total) * 100);
  const invPct = Math.round((project.invoiceDesigns.used / project.invoiceDesigns.total) * 100);
  return (
    <div onClick={() => onSelect(project.id)} style={{ background: "#0c1628", border: "1px solid #1a2744", borderRadius: 16, padding: 20, cursor: "pointer", transition: "border-color 0.2s, transform 0.15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2744"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{project.name}</div>
          <div style={{ fontSize: 12, color: "#475569" }}>{project.client} · {project.clientEmail}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <SupportBadge days={daysLeft} />
          {project.server && project.server.active && project.server.endDate && (() => {
            const sd = getDaysRemaining(project.server.endDate);
            return (
              <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, fontWeight: 700,
                background: sd <= 30 ? "#450a0a" : sd <= 90 ? "#451a03" : "#0a1525",
                color: sd <= 30 ? "#ef4444" : sd <= 90 ? "#f59e0b" : "#38bdf8",
                border: "1px solid", borderColor: sd <= 30 ? "#ef444433" : sd <= 90 ? "#f59e0b33" : "#38bdf833"
              }}>🖥 Server: {sd <= 0 ? "Expired" : `${sd}h lagi`}</span>
            );
          })()}
        </div>
      </div>
      <StageIndicator stages={project.implementation.stages} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <div style={{ ...MINI, padding: 12 }}>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.2 }}>Layanan Teknis</div>
          <ProgressBar value={project.trainingHours.used} max={project.trainingHours.total} />
          <div style={{ fontSize: 20, fontWeight: 800, color: trainPct >= 90 ? "#ef4444" : "#38bdf8", marginTop: 6 }}>
            {project.trainingHours.total - project.trainingHours.used} <span style={{ fontSize: 11, fontWeight: 400, color: "#475569" }}>jam sisa</span>
          </div>
        </div>
        <div style={{ ...MINI, padding: 12 }}>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.2 }}>Desain Faktur</div>
          <ProgressBar value={project.invoiceDesigns.used} max={project.invoiceDesigns.total} color="#a78bfa" />
          <div style={{ fontSize: 20, fontWeight: 800, color: invPct >= 90 ? "#ef4444" : "#a78bfa", marginTop: 6 }}>
            {project.invoiceDesigns.total - project.invoiceDesigns.used} <span style={{ fontSize: 11, fontWeight: 400, color: "#475569" }}>sisa</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, textAlign: "right" }}>
        <span style={{ fontSize: 11, color: "#334155" }}>Klik untuk detail & edit →</span>
      </div>
    </div>
  );
}

// ─── DETAIL VIEW ──────────────────────────────────────────────────────────────

// ─── FILTER GROUP DROPDOWN ───────────────────────────────────────────────────
function FilterGroup({ label, filterKey, current, onToggle, options }) {
  const [open, setOpen] = useState(false);
  const isActive = current !== "all";
  const activeOption = options.find(([v]) => v === current);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{
        padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${isActive ? (activeOption?.[2] || "#38bdf8") : "#1e293b"}`,
        background: isActive ? (activeOption?.[3] || "#0c2a3f") : "#0c1628",
        color: isActive ? (activeOption?.[2] || "#38bdf8") : "#64748b",
        display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        transition: "all 0.15s",
      }}>
        {isActive ? `${label}: ${activeOption?.[1] || current}` : label}
        <span style={{ fontSize: 10, opacity: 0.7 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 98 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 6, zIndex: 99, minWidth: 180, boxShadow: "0 8px 32px #00000066" }}>
            {/* All option */}
            <button onClick={() => { onToggle(filterKey, "all"); setOpen(false); }} style={{
              width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", textAlign: "left",
              background: current === "all" ? "#1e293b" : "transparent",
              color: current === "all" ? "#e2e8f0" : "#64748b",
              fontSize: 12, cursor: "pointer", fontWeight: current === "all" ? 600 : 400,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              {current === "all" && <span style={{ color: "#38bdf8" }}>✓</span>}
              Semua
            </button>
            {options.map(([val, lbl, color, bg]) => (
              <button key={val} onClick={() => { onToggle(filterKey, val); setOpen(false); }} style={{
                width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", textAlign: "left",
                background: current === val ? bg : "transparent",
                color: current === val ? color : "#94a3b8",
                fontSize: 12, cursor: "pointer", fontWeight: current === val ? 700 : 400,
                display: "flex", alignItems: "center", gap: 8,
                transition: "background 0.1s",
              }}
                onMouseEnter={e => { if (current !== val) e.currentTarget.style.background = "#0a1525"; }}
                onMouseLeave={e => { if (current !== val) e.currentTarget.style.background = "transparent"; }}
              >
                {current === val && <span>✓</span>}
                {lbl}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── OVERVIEW TAB WITH COMPANY PICKER ────────────────────────────────────────
function OverviewTab({ p, updateField, SaveBtn }) {
  const SUPA_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
  const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPA_KEY;
    fetch(`${SUPA_URL}/rest/v1/companies?order=name.asc`, {
      headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${token}` }
    }).then(r => r.json()).then(setCompanies).catch(() => {});
  }, []);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.pic_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const selectCompany = (c) => {
    updateField("client", c.name);
    if (c.pic_phone) updateField("clientEmail", c.pic_phone);
    setOpen(false);
    setSearch("");
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Nama Klien - with company picker */}
        <div style={MINI}>
          <label style={{ fontSize: 11, color: "#64748b" }}>Nama Klien / Perusahaan</label>
          {companies.length > 0 && (
            <div style={{ marginTop: 6, marginBottom: 6 }}>
              <button type="button" onClick={() => setOpen(!open)} style={{ padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${open ? "#38bdf8" : "#1e293b"}`, background: open ? "#0c2a3f" : "transparent", color: open ? "#38bdf8" : "#475569" }}>
                🏢 Pilih dari Master {open ? "▲" : "▼"}
              </button>
              {open && (
                <div style={{ marginTop: 6, background: "#060d1a", border: "1px solid #1e293b", borderRadius: 10, padding: 10, position: "relative", zIndex: 100 }}>
                  <input style={{ ...INP, marginTop: 0, marginBottom: 8 }} placeholder="Cari perusahaan..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
                  <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {filtered.map(c => (
                      <button key={c.id} type="button" onClick={() => selectCompany(c)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${p.client === c.name ? "#10b981" : "#1e293b"}`, background: p.client === c.name ? "#052e16" : "transparent", color: "#e2e8f0", cursor: "pointer", textAlign: "left", fontSize: 13 }}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        {c.pic_name && <div style={{ fontSize: 11, color: "#475569" }}>👤 {c.pic_name} {c.pic_phone && `· ${c.pic_phone}`}</div>}
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: c.status === "klien" ? "#052e16" : "#451a03", color: c.status === "klien" ? "#10b981" : "#f59e0b" }}>{c.status === "klien" ? "Klien" : "Prospek"}</span>
                      </button>
                    ))}
                    {filtered.length === 0 && <div style={{ fontSize: 12, color: "#334155", padding: 8 }}>Tidak ditemukan</div>}
                  </div>
                </div>
              )}
            </div>
          )}
          <input type="text" style={INP} value={p.client} onChange={e => updateField("client", e.target.value)} placeholder="Nama klien / perusahaan" />
        </div>

        {/* Email Klien */}
        <div style={MINI}>
          <label style={{ fontSize: 11, color: "#64748b" }}>Email / No. HP Klien</label>
          <input type="text" style={INP} value={p.clientEmail} onChange={e => updateField("clientEmail", e.target.value)} placeholder="Email atau no HP" />
        </div>

        {/* Nama Proyek */}
        <div style={MINI}>
          <label style={{ fontSize: 11, color: "#64748b" }}>Nama Proyek</label>
          <input type="text" style={INP} value={p.name} onChange={e => updateField("name", e.target.value)} />
        </div>

        {/* Tanggal Mulai */}
        <div style={MINI}>
          <label style={{ fontSize: 11, color: "#64748b" }}>Tanggal Mulai</label>
          <input type="date" style={INP} value={p.startDate} onChange={e => updateField("startDate", e.target.value)} />
        </div>
      </div>
      <SaveBtn />
    </div>
  );
}

function DetailView({ project, onClose, onSave, onDelete, canEdit = true, canDelete = true, canTraining = true, currentUser }) {
  const [p, setP] = useState(() => JSON.parse(JSON.stringify(project)));
  const [activeTab, setActiveTab] = useState("overview");
  const [editStage, setEditStage] = useState(null);
  const [stageNote, setStageNote] = useState("");
  const [stageDate, setStageDate] = useState("");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error

  useEffect(() => { setP(JSON.parse(JSON.stringify(project))); setSaveState("idle"); }, [project.id]);

  const updateField = (path, value) => {
    const parts = path.split(".");
    setP(prev => {
      const updated = JSON.parse(JSON.stringify(prev));
      let obj = updated;
      for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
      obj[parts[parts.length - 1]] = value;
      return updated;
    });
    setSaveState("idle");
  };

  const handleSave = async (dataToSave) => {
    const target = dataToSave || p;
    setSaveState("saving");
    try {
      await onSave(target);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const openStageEdit = (stage) => { setEditStage(stage.id); setStageNote(stage.notes); setStageDate(stage.date); };

  const saveStage = async (stageId, newStatus) => {
    const updated = JSON.parse(JSON.stringify(p));
    const s = updated.implementation.stages.find(x => x.id === stageId);
    if (s) { s.notes = stageNote; s.date = stageDate; if (newStatus) s.status = newStatus; }
    setP(updated);
    setEditStage(null);
    await handleSave(updated);
  };

  const renewSupport = async () => {
    const updated = JSON.parse(JSON.stringify(p));
    const end = new Date(updated.freeSupport.endDate);
    end.setFullYear(end.getFullYear() + 1);
    updated.freeSupport.endDate = end.toISOString().split("T")[0];
    updated.freeSupport.renewals += 1;
    setP(updated);
    await handleSave(updated);
  };

  const daysLeft = getDaysRemaining(p.freeSupport.endDate);
  const tabs = ["overview", "training", "faktur", "implementasi", "support", "server"];
  const tabLabel = { overview: "Overview", training: "Layanan Teknis", faktur: "Desain Faktur", implementasi: "Implementasi", support: "Free Support", server: "Server" };

  const SaveBtn = () => {
    if (!canEdit) return <div style={{ fontSize:12, color:"#475569", padding:"10px 0" }}>🔒 Anda hanya bisa melihat data</div>;
    const states = {
      idle: { bg: "#1d4ed8", label: "Simpan Perubahan" },
      saving: { bg: "#1e3a5f", label: "Menyimpan..." },
      saved: { bg: "#065f46", label: "✓ Tersimpan!" },
      error: { bg: "#7f1d1d", label: "✗ Gagal, coba lagi" },
    };
    const s = states[saveState];
    return (
      <button onClick={() => handleSave()} disabled={saveState === "saving"} style={{ ...BTN, background: s.bg, minWidth: 160, transition: "background 0.3s" }}>
        {s.label}
      </button>
    );
  };

  return (
    <Modal title={p.name} onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid", borderColor: activeTab === t ? "#38bdf8" : "#1e293b", background: activeTab === t ? "#0c4a6e" : "transparent", color: activeTab === t ? "#38bdf8" : "#64748b", fontSize: 12, cursor: "pointer" }}>{tabLabel[t]}</button>
          ))}
        </div>
        <button onClick={() => { if (window.confirm(`Hapus proyek "${p.name}"?`)) onDelete(); }} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #7f1d1d", background: "#1c0a0a", color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>🗑 Hapus</button>
      </div>

      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[["client","Nama Klien","text"],["clientEmail","Email Klien","email"],["name","Nama Proyek","text"],["startDate","Tanggal Mulai","date"]].map(([k,label,type]) => (
              <div key={k} style={MINI}>
                <label style={{ fontSize: 11, color: "#64748b" }}>{label}</label>
                <input type={type} style={INP} value={p[k]} onChange={e => updateField(k, e.target.value)} />
              </div>
            ))}
          </div>
          <SaveBtn />
        </div>
      )}

      {activeTab === "training" && (
        <TrainingTab
          project={p}
          canEdit={canEdit}
          canTraining={canTraining}
          canDelete={canDelete}
          currentUser={currentUser}
          onUpdateHours={(total, used) => {
            updateField("trainingHours.total", total);
            updateField("trainingHours.used", used);
          }}
          onSave={handleSave}
        />
      )}

      {activeTab === "faktur" && (
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>Pantau sisa kuota desain faktur.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={MINI}><label style={{ fontSize: 11, color: "#64748b" }}>Total Desain (Kontrak)</label><input type="number" style={INP} value={p.invoiceDesigns.total} onChange={e => updateField("invoiceDesigns.total", +e.target.value)} /></div>
            <div style={MINI}><label style={{ fontSize: 11, color: "#64748b" }}>Desain Terpakai</label><input type="number" style={INP} value={p.invoiceDesigns.used} onChange={e => updateField("invoiceDesigns.used", +e.target.value)} /></div>
          </div>
          <div style={{ ...MINI, marginBottom: 16 }}>
            <ProgressBar value={p.invoiceDesigns.used} max={p.invoiceDesigns.total} color="#a78bfa" />
            <div style={{ marginTop: 12, display: "flex", gap: 20 }}>
              {[[p.invoiceDesigns.total-p.invoiceDesigns.used,"#a78bfa","desain tersisa"],[p.invoiceDesigns.used,"#64748b","sudah digunakan"]].map(([v,c,l]) => (
                <div key={l}><div style={{ fontSize: 26, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 11, color: "#475569" }}>{l}</div></div>
              ))}
            </div>
          </div>
          <SaveBtn />
        </div>
      )}

      {activeTab === "implementasi" && (
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>Klik Edit untuk ubah status, catatan, dan tanggal.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.implementation.stages.map(stage => (
              <div key={stage.id} style={{ ...MINI, borderLeft: `3px solid ${stage.status==="done"?"#10b981":stage.status==="in-progress"?"#f59e0b":"#334155"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: stage.status==="done"?"#10b981":stage.status==="in-progress"?"#f59e0b":"#475569", marginRight: 8 }}>
                      {stage.status==="done"?"✓ Selesai":stage.status==="in-progress"?"● Berjalan":"○ Pending"}
                    </span>
                    <span style={{ fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>{stage.name}</span>
                    {stage.date && <span style={{ fontSize: 11, color: "#475569", marginLeft: 8 }}>{stage.date}</span>}
                  </div>
                  <button onClick={() => openStageEdit(stage)} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#94a3b8", cursor: "pointer" }}>Edit</button>
                </div>
                {stage.notes && <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>📝 {stage.notes}</div>}
                {editStage === stage.id && (
                  <div style={{ marginTop: 12, borderTop: "1px solid #1e293b", paddingTop: 12 }}>
                    <div style={{ marginBottom: 8 }}>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Catatan</label>
                      <textarea style={{ ...INP, resize: "vertical" }} rows={3} value={stageNote} onChange={e => setStageNote(e.target.value)} placeholder="Tambahkan catatan..." />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Tanggal Selesai</label>
                      <input type="date" style={INP} value={stageDate} onChange={e => setStageDate(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[["done","#065f46","#10b981","✓ Selesai"],["in-progress","#78350f","#f59e0b","● Berjalan"],["pending","#1e293b","#94a3b8","○ Pending"]].map(([st,bg,color,label]) => (
                        <button key={st} onClick={() => saveStage(stage.id, st)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "none", background: bg, color }}>{label}</button>
                      ))}
                      <button onClick={() => setEditStage(null)} style={{ padding: "6px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", border: "1px solid #334155", background: "transparent", color: "#64748b" }}>Batal</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "support" && (
        <div>
          <div style={{ ...MINI, background: daysLeft<=0?"#1c0a0a":daysLeft<=30?"#1c0f00":"#0a1a0a", borderColor: daysLeft<=0?"#ef4444":daysLeft<=30?"#f59e0b":"#10b981", borderStyle:"solid", borderWidth:1, marginBottom:16 }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: daysLeft<=0?"#ef4444":daysLeft<=30?"#f59e0b":"#10b981" }}>{daysLeft<=0?"Expired":`${daysLeft} hari`}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{daysLeft<=0?"Free support sudah berakhir":"tersisa sebelum free support berakhir"}</div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>Mulai: {p.freeSupport.startDate} · Berakhir: {p.freeSupport.endDate} · Diperpanjang: {p.freeSupport.renewals}x</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={MINI}><label style={{ fontSize: 11, color: "#64748b" }}>Tanggal Mulai Support</label><input type="date" style={INP} value={p.freeSupport.startDate} onChange={e => updateField("freeSupport.startDate", e.target.value)} /></div>
            <div style={MINI}><label style={{ fontSize: 11, color: "#64748b" }}>Tanggal Berakhir Support</label><input type="date" style={INP} value={p.freeSupport.endDate} onChange={e => updateField("freeSupport.endDate", e.target.value)} /></div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <SaveBtn />
            <button onClick={renewSupport} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #10b981", background: "#052e16", color: "#10b981", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>🔄 Perpanjang +1 Tahun</button>
          </div>
        </div>
      )}

      {activeTab === "server" && (() => {
        const svrDays = p.server.active && p.server.endDate ? getDaysRemaining(p.server.endDate) : null;
        const renewServer = async () => {
          const updated = JSON.parse(JSON.stringify(p));
          const end = new Date(updated.server.endDate || new Date());
          end.setFullYear(end.getFullYear() + 1);
          updated.server.endDate = end.toISOString().split("T")[0];
          if (!updated.server.startDate) updated.server.startDate = new Date().toISOString().split("T")[0];
          setP(updated);
          await handleSave(updated);
        };
        return (
          <div>
            {/* Toggle aktif/tidak */}
            <div style={{ ...MINI, marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>Gunakan Server Kami</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>Aktifkan jika klien berlangganan server</div>
              </div>
              <div onClick={() => updateField("server.active", !p.server.active)} style={{
                width: 52, height: 28, borderRadius: 999, cursor: "pointer", transition: "background 0.2s",
                background: p.server.active ? "#10b981" : "#1e293b", position: "relative", flexShrink: 0,
              }}>
                <div style={{ position: "absolute", top: 3, left: p.server.active ? 26 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
            </div>

            {p.server.active ? (
              <>
                {/* Status banner */}
                {p.server.endDate && (
                  <div style={{ ...MINI, background: svrDays<=0?"#1c0a0a":svrDays<=30?"#1c0f00":svrDays<=90?"#1c1200":"#0a1a0a", borderColor: svrDays<=0?"#ef4444":svrDays<=30?"#ef4444":svrDays<=90?"#f59e0b":"#10b981", borderStyle:"solid", borderWidth:1, marginBottom:16 }}>
                    <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                      <div style={{ fontSize: 38, fontWeight: 900, color: svrDays<=0?"#ef4444":svrDays<=30?"#ef4444":svrDays<=90?"#f59e0b":"#10b981" }}>
                        {svrDays<=0?"Expired":`${svrDays} hari`}
                      </div>
                      {svrDays>0 && <div style={{ fontSize:14, color:"#64748b" }}>tersisa</div>}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                      {svrDays<=0 ? "Langganan server sudah berakhir — perlu diperpanjang!" : svrDays<=30 ? "⚠️ Segera perpanjang sebelum expired!" : svrDays<=90 ? "Langganan akan habis dalam waktu dekat" : "Langganan server aktif"}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#475569" }}>Mulai: {p.server.startDate||"-"} · Berakhir: {p.server.endDate||"-"}</div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div style={MINI}>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Tanggal Mulai Berlangganan</label>
                    <input type="date" style={INP} value={p.server.startDate} onChange={e => updateField("server.startDate", e.target.value)} />
                  </div>
                  <div style={MINI}>
                    <label style={{ fontSize: 11, color: "#64748b" }}>Tanggal Jatuh Tempo</label>
                    <input type="date" style={INP} value={p.server.endDate} onChange={e => updateField("server.endDate", e.target.value)} />
                  </div>
                </div>
                <div style={{ ...MINI, marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: "#64748b", display:"block", marginBottom: 4 }}>Catatan / Spesifikasi Server</label>
                  <textarea style={{ ...INP, resize:"vertical" }} rows={3} value={p.server.notes} onChange={e => updateField("server.notes", e.target.value)} placeholder="Contoh: VPS 4 Core 8GB RAM, Ubuntu 22.04..." />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <SaveBtn />
                  <button onClick={renewServer} style={{ padding:"10px 20px", borderRadius:8, border:"1px solid #10b981", background:"#052e16", color:"#10b981", cursor:"pointer", fontWeight:600, fontSize:14 }}>🔄 Perpanjang +1 Tahun</button>
                </div>
              </>
            ) : (
              <div style={{ textAlign:"center", padding:"40px 20px", color:"#334155" }}>
                <div style={{ fontSize: 40 }}>🖥️</div>
                <div style={{ fontSize: 15, marginTop: 12, color: "#475569" }}>Klien ini tidak menggunakan server kami</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Aktifkan toggle di atas jika klien berlangganan server</div>
                <button onClick={() => { updateField("server.active", true); }} style={{ ...BTN, marginTop: 16 }}>Aktifkan Server</button>
              </div>
            )}
          </div>
        );
      })()}
    </Modal>
  );
}

// ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────

function getStatusLabel(s) { return s==="done"?"Selesai":s==="in-progress"?"Berjalan":"Pending"; }
function getSupportStatus(d) { return d<=0?"Expired":d<=30?"Kritis (≤30 hari)":d<=90?"Perhatian (≤90 hari)":"Aktif"; }

function exportToExcel(projects) {
  const wb = XLSX.utils.book_new();
  const today = new Date().toLocaleDateString("id-ID");
  const ws1 = XLSX.utils.aoa_to_sheet([
    ["LAPORAN RINGKASAN PROYEK"],[`Digenerate: ${today}`],[],
    ["No","Nama Proyek","Klien","Email","Tgl Mulai","Jam Total","Jam Pakai","Jam Sisa","% Training","Desain Total","Desain Pakai","Desain Sisa","% Faktur","Support Mulai","Support Berakhir","Sisa Hari","Status Support","Perpanjangan","Tahap Selesai","Total Tahap","% Impl","Status Aktif"],
    ...projects.map((p,i)=>{const d=getDaysRemaining(p.freeSupport.endDate);const done=p.implementation.stages.filter(s=>s.status==="done").length;const total=p.implementation.stages.length;const active=p.implementation.stages.find(s=>s.status==="in-progress");return[i+1,p.name,p.client,p.clientEmail,p.startDate,p.trainingHours.total,p.trainingHours.used,p.trainingHours.total-p.trainingHours.used,`${Math.round(p.trainingHours.used/p.trainingHours.total*100)}%`,p.invoiceDesigns.total,p.invoiceDesigns.used,p.invoiceDesigns.total-p.invoiceDesigns.used,`${Math.round(p.invoiceDesigns.used/p.invoiceDesigns.total*100)}%`,p.freeSupport.startDate,p.freeSupport.endDate,d,getSupportStatus(d),p.freeSupport.renewals,done,total,`${Math.round(done/total*100)}%`,active?active.name:(done===total?"Selesai Semua":"-")];})
  ]);
  XLSX.utils.book_append_sheet(wb,ws1,"Ringkasan Proyek");
  const implRows=[["DETAIL IMPLEMENTASI"],[`Digenerate: ${today}`],[],["Nama Proyek","Klien","No","Tahap","Status","Tanggal","Catatan"]];
  projects.forEach(p=>{p.implementation.stages.forEach(s=>implRows.push([p.name,p.client,s.id,s.name,getStatusLabel(s.status),s.date||"-",s.notes||"-"]));implRows.push([]);});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(implRows),"Detail Implementasi");
  const ws3=XLSX.utils.aoa_to_sheet([["LAPORAN FREE SUPPORT"],[`Digenerate: ${today}`],[],["Nama Proyek","Klien","Email","Tgl Mulai","Tgl Berakhir","Sisa Hari","Status","Perpanjangan"],...projects.map(p=>{const d=getDaysRemaining(p.freeSupport.endDate);return[p.name,p.client,p.clientEmail,p.freeSupport.startDate,p.freeSupport.endDate,d,getSupportStatus(d),p.freeSupport.renewals];})]);
  XLSX.utils.book_append_sheet(wb,ws3,"Free Support");
  const tT=projects.reduce((a,p)=>a+p.trainingHours.total,0),tU=projects.reduce((a,p)=>a+p.trainingHours.used,0),iT=projects.reduce((a,p)=>a+p.invoiceDesigns.total,0),iU=projects.reduce((a,p)=>a+p.invoiceDesigns.used,0);
  const ws4=XLSX.utils.aoa_to_sheet([["LAPORAN KUOTA LAYANAN TEKNIS"],[`Digenerate: ${today}`],[],["Nama Proyek","Klien","Jam Total","Jam Pakai","Jam Sisa","% Training","Desain Total","Desain Pakai","Desain Sisa","% Faktur"],...projects.map(p=>[p.name,p.client,p.trainingHours.total,p.trainingHours.used,p.trainingHours.total-p.trainingHours.used,`${(p.trainingHours.used/p.trainingHours.total*100).toFixed(1)}%`,p.invoiceDesigns.total,p.invoiceDesigns.used,p.invoiceDesigns.total-p.invoiceDesigns.used,`${(p.invoiceDesigns.used/p.invoiceDesigns.total*100).toFixed(1)}%`]),[],["TOTAL",`${projects.length} Proyek`,tT,tU,tT-tU,`${(tU/tT*100).toFixed(1)}%`,iT,iU,iT-iU,`${(iU/iT*100).toFixed(1)}%`]]);
  XLSX.utils.book_append_sheet(wb,ws4,"Kuota Layanan");
  XLSX.writeFile(wb,`Laporan_Proyek_${today.replace(/\//g,"-")}.xlsx`);
}

// ─── LAPORAN MODAL ────────────────────────────────────────────────────────────

function LaporanModal({ projects, onClose, embedded }) {
  const [selected, setSelected] = useState(projects.map(p => p.id));
  const [filterSupport, setFilterSupport] = useState("all");
  const [filterImpl, setFilterImpl] = useState("all");
  const [filterServer, setFilterServer] = useState("all");
  const [search, setSearch] = useState("");

  // Apply filters to project list
  const visibleProjects = projects.filter(p => {
    if (search && !p.client.toLowerCase().includes(search.toLowerCase()) &&
        !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSupport !== "all") {
      const d = getDaysRemaining(p.freeSupport.endDate);
      if (filterSupport === "expired" && d > 0) return false;
      if (filterSupport === "warning" && (d <= 0 || d > 90)) return false;
      if (filterSupport === "active" && d <= 90) return false;
    }
    if (filterImpl !== "all") {
      const allDone = p.implementation.stages.every(s => s.status === "done");
      const hasActive = p.implementation.stages.some(s => s.status === "in-progress");
      if (filterImpl === "done" && !allDone) return false;
      if (filterImpl === "running" && !hasActive) return false;
      if (filterImpl === "pending" && (allDone || hasActive)) return false;
    }
    if (filterServer !== "all") {
      const hasServer = p.server && p.server.active;
      const expiring = hasServer && p.server.endDate && getDaysRemaining(p.server.endDate) <= 30;
      if (filterServer === "active" && !hasServer) return false;
      if (filterServer === "none" && hasServer) return false;
      if (filterServer === "expiring" && !expiring) return false;
    }
    return true;
  });

  // Sync selected when filter changes
  useEffect(() => {
    setSelected(visibleProjects.map(p => p.id));
  }, [filterSupport, filterImpl, filterServer, search]);

  const toggle = id => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const filtered = projects.filter(p => selected.includes(p.id));

  const resetFilters = () => { setFilterSupport("all"); setFilterImpl("all"); setFilterServer("all"); setSearch(""); };
  const hasFilter = filterSupport !== "all" || filterImpl !== "all" || filterServer !== "all" || search;

  const FilterChip = ({ active, onClick, color, bg, label }) => (
    <button onClick={onClick} style={{
      padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${active ? color : "#1e293b"}`,
      background: active ? bg : "transparent",
      color: active ? color : "#475569", transition: "all 0.15s",
    }}>{label}</button>
  );

  return (
    <Modal title="📊 Modul Laporan & Export Excel" onClose={onClose} wide>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          ["Proyek Dipilih", filtered.length, "#38bdf8", ""],
          ["Total Layanan Teknis", filtered.reduce((a,p)=>a+p.trainingHours.total,0), "#10b981", " jam"],
          ["Total Desain Faktur", filtered.reduce((a,p)=>a+p.invoiceDesigns.total,0), "#a78bfa", " desain"],
          ["Support Kritis", filtered.filter(p=>getDaysRemaining(p.freeSupport.endDate)<=30).length, "#ef4444", ""],
        ].map(([l,v,c,u]) => (
          <div key={l} style={{ ...MINI, padding:"12px 14px" }}>
            <div style={{ fontSize:22, fontWeight:800, color:c }}>{v}<span style={{ fontSize:11, color:"#475569", fontWeight:400 }}>{u}</span></div>
            <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Filter Panel */}
      <div style={{ ...MINI, marginBottom: 16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:1 }}>🎛 Filter Laporan</div>
          {hasFilter && (
            <button onClick={resetFilters} style={{ fontSize:11, padding:"3px 10px", borderRadius:6, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>✕ Reset</button>
          )}
        </div>

        {/* Search */}
        <div style={{ position:"relative", marginBottom:12 }}>
          <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:"#475569", fontSize:13 }}>🔍</span>
          <input type="text" placeholder="Cari nama proyek / klien..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ width:"100%", background:"#060d1a", border:"1px solid #1e293b", borderRadius:8, padding:"7px 12px 7px 32px", color:"#e2e8f0", fontSize:13, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
          {search && <span onClick={()=>setSearch("")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", cursor:"pointer", color:"#475569" }}>✕</span>}
        </div>

        {/* Filter rows */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"#475569", minWidth:90 }}>Free Support</span>
            {[["all","Semua","#64748b","#0f172a"],["active","Aktif","#10b981","#052e16"],["warning","⚠️ Hampir Habis","#f59e0b","#451a03"],["expired","Expired","#ef4444","#450a0a"]].map(([v,l,c,bg])=>(
              <FilterChip key={v} active={filterSupport===v} onClick={()=>setFilterSupport(v)} color={c} bg={bg} label={l} />
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"#475569", minWidth:90 }}>Implementasi</span>
            {[["all","Semua","#64748b","#0f172a"],["running","Berjalan","#f59e0b","#451a03"],["done","Selesai","#10b981","#052e16"],["pending","Belum Mulai","#475569","#0f172a"]].map(([v,l,c,bg])=>(
              <FilterChip key={v} active={filterImpl===v} onClick={()=>setFilterImpl(v)} color={c} bg={bg} label={l} />
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:"#475569", minWidth:90 }}>Server</span>
            {[["all","Semua","#64748b","#0f172a"],["active","Pakai Server","#38bdf8","#0c2a3f"],["none","No Server","#475569","#0f172a"],["expiring","Mau Habis","#ef4444","#450a0a"]].map(([v,l,c,bg])=>(
              <FilterChip key={v} active={filterServer===v} onClick={()=>setFilterServer(v)} color={c} bg={bg} label={l} />
            ))}
          </div>
        </div>

        {/* Result info */}
        <div style={{ marginTop:12, fontSize:12, color:"#334155" }}>
          {hasFilter
            ? <span>Filter aktif: menampilkan <span style={{ color:"#38bdf8", fontWeight:600 }}>{visibleProjects.length}</span> dari {projects.length} proyek</span>
            : <span style={{ color:"#1e293b" }}>Semua {projects.length} proyek ditampilkan</span>
          }
        </div>
      </div>

      {/* Project checklist */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#94a3b8" }}>
            Pilih Proyek untuk Diexport
            <span style={{ fontSize:11, color:"#334155", marginLeft:8 }}>({filtered.length} dipilih)</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setSelected(visibleProjects.map(p=>p.id))} style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>Pilih Semua</button>
            <button onClick={()=>setSelected([])} style={{ fontSize:11, padding:"4px 10px", borderRadius:6, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>Kosongkan</button>
          </div>
        </div>

        {visibleProjects.length === 0 ? (
          <div style={{ textAlign:"center", padding:"24px", color:"#334155", fontSize:13 }}>Tidak ada proyek yang cocok dengan filter</div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:280, overflowY:"auto" }}>
            {visibleProjects.map(p => {
              const isChecked = selected.includes(p.id);
              const days = getDaysRemaining(p.freeSupport.endDate);
              const doneStages = p.implementation.stages.filter(s=>s.status==="done").length;
              return (
                <div key={p.id} onClick={()=>toggle(p.id)} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", background:isChecked?"#0d1f38":"#0a1525", border:`1px solid ${isChecked?"#1d4ed8":"#1a2744"}`, borderRadius:10, cursor:"pointer", transition:"all 0.15s" }}>
                  <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${isChecked?"#3b82f6":"#334155"}`, background:isChecked?"#1d4ed8":"transparent", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:11, fontWeight:700, flexShrink:0 }}>{isChecked?"✓":""}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600, color:"#e2e8f0", fontSize:13 }}>{p.name}</div>
                    <div style={{ fontSize:11, color:"#475569" }}>{p.client}</div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
                    <span style={badgeStyle("#0c1628","#38bdf8")}>{doneStages}/{p.implementation.stages.length} tahap</span>
                    <SupportBadge days={days} />
                    {p.server?.active && <span style={badgeStyle("#0c2a3f","#38bdf8")}>🖥 Server</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sheet info */}
      <div style={{ background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:14, marginBottom:16 }}>
        <div style={{ fontSize:11, color:"#475569", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>4 Sheet yang akan digenerate</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
          {[["📋","Ringkasan Proyek"],["🔧","Detail Implementasi"],["🛡️","Free Support"],["📦","Kuota Layanan"]].map(([icon,title])=>(
            <div key={title} style={{ fontSize:12, color:"#64748b" }}>{icon} {title}</div>
          ))}
        </div>
      </div>

      {/* Export button */}
      <button onClick={()=>filtered.length>0&&exportToExcel(filtered)} disabled={filtered.length===0} style={{ ...BTN, background:filtered.length===0?"#1e293b":"#059669", color:filtered.length===0?"#334155":"#fff", cursor:filtered.length===0?"not-allowed":"pointer", fontSize:15, padding:"12px 28px" }}>
        ⬇️ Export Excel ({filtered.length} proyek)
      </button>
    </Modal>
  );
}


// ─── ADD PROJECT ──────────────────────────────────────────────────────────────

function AddProjectModal({ onClose, onAdd }) {
  const SUPA_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
  const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
  const [form, setForm] = useState({ name:"", client:"", clientEmail:"", startDate:new Date().toISOString().split("T")[0], trainTotal:40, invTotal:10 });
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [compSearch, setCompSearch] = useState("");
  const [showCompPicker, setShowCompPicker] = useState(false);
  const f = (k,v) => setForm(x=>({...x,[k]:v}));

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPA_KEY;
    fetch(`${SUPA_URL}/rest/v1/companies?order=name.asc`, { headers:{"apikey":SUPA_KEY,"Authorization":`Bearer ${token}`} })
      .then(r=>r.json()).then(setCompanies).catch(()=>{});
  }, []);

  const selectCompany = (c) => {
    setForm(x=>({...x, client:c.name, clientEmail: c.pic_phone ? "" : "", name: x.name || "" }));
    setShowCompPicker(false); setCompSearch("");
  };

  const filteredComps = companies.filter(c => c.name.toLowerCase().includes(compSearch.toLowerCase()) || (c.pic_name||"").toLowerCase().includes(compSearch.toLowerCase()));

  const submit = async () => {
    if (!form.name||!form.client) { alert("Nama proyek dan nama klien wajib diisi!"); return; }
    setLoading(true);
    const end = new Date(form.startDate); end.setFullYear(end.getFullYear()+1);
    const newProj = {
      id:"proj-"+Date.now(), name:form.name, client:form.client, clientEmail:form.clientEmail, startDate:form.startDate,
      trainingHours:{total:+form.trainTotal,used:0}, invoiceDesigns:{total:+form.invTotal,used:0},
      freeSupport:{startDate:form.startDate,endDate:end.toISOString().split("T")[0],renewals:0},
      server:{active:false,startDate:"",endDate:"",notes:""},
      implementation:{stages:[
        {id:1,name:"Analisis Kebutuhan",status:"pending",notes:"",date:""},
        {id:2,name:"Setup & Instalasi",status:"pending",notes:"",date:""},
        {id:3,name:"Training Tim",status:"pending",notes:"",date:""},
        {id:4,name:"Uji Coba (UAT)",status:"pending",notes:"",date:""},
        {id:5,name:"Go Live",status:"pending",notes:"",date:""},
        {id:6,name:"Post-Implementation Review",status:"pending",notes:"",date:""},
      ]},
    };
    await onAdd(newProj);
    setLoading(false);
  };

  return (
    <Modal title="Tambah Proyek Baru" onClose={onClose}>
      {/* Client picker from Master Perusahaan */}
      {companies.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:"#64748b", marginBottom:6 }}>Pilih dari Data Master Perusahaan (opsional)</div>
          <button onClick={()=>setShowCompPicker(!showCompPicker)} style={{ padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", border:"1px solid #1d4ed8", background: showCompPicker?"#0c2a3f":"transparent", color:"#38bdf8" }}>
            🏢 {form.client ? `Terpilih: ${form.client}` : "Pilih Perusahaan"}
          </button>
          {showCompPicker && (
            <div style={{ marginTop:8, background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:12 }}>
              <input style={{ ...INP, marginTop:0, marginBottom:10 }} placeholder="Cari perusahaan..." value={compSearch} onChange={e=>setCompSearch(e.target.value)} autoFocus />
              <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:200, overflowY:"auto" }}>
                {filteredComps.map(c => (
                  <button key={c.id} onClick={()=>selectCompany(c)} style={{ padding:"9px 12px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:"#e2e8f0", cursor:"pointer", textAlign:"left", fontSize:13, display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ padding:"1px 8px", borderRadius:999, fontSize:10, fontWeight:700, background:c.status==="klien"?"#052e16":"#451a03", color:c.status==="klien"?"#10b981":"#f59e0b" }}>{c.status==="klien"?"Klien":"Prospek"}</span>
                    <span style={{ fontWeight:600 }}>{c.name}</span>
                    {c.pic_name && <span style={{ fontSize:11, color:"#475569" }}>· {c.pic_name}</span>}
                  </button>
                ))}
                {filteredComps.length===0 && <div style={{ color:"#334155", fontSize:12, textAlign:"center", padding:10 }}>Tidak ditemukan</div>}
              </div>
            </div>
          )}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[["name","Nama Proyek *","text"],["client","Nama Klien *","text"],["clientEmail","Email Klien","email"],["startDate","Tanggal Mulai","date"],["trainTotal","Total Layanan Teknis","number"],["invTotal","Total Desain Faktur","number"]].map(([k,label,type])=>(
          <div key={k} style={MINI}>
            <label style={{ fontSize:11, color:"#64748b", display:"block", marginBottom:4 }}>{label}</label>
            <input type={type} style={INP} value={form[k]} onChange={e=>f(k,e.target.value)} />
          </div>
        ))}
      </div>
      <div style={{ marginTop:16, display:"flex", gap:10 }}>
        <button onClick={submit} disabled={loading} style={{ ...BTN, opacity:loading?0.7:1 }}>{loading?"Menyimpan...":"Tambah Proyek"}</button>
        <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>Batal</button>
      </div>
    </Modal>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showUserMgr, setShowUserMgr] = useState(false);
  const [showKomisi, setShowKomisi] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showMaster, setShowMaster] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLaporan, setShowLaporan] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ support: "all", impl: "all", server: "all" });

  useEffect(() => {
    async function init() {
      // Handle OAuth callback (Google login redirect)
      const oauthSession = await handleOAuthCallback();
      // Get current user
      let user = await getCurrentUser();
      if (!user && oauthSession) {
        await new Promise(r => setTimeout(r, 800));
        user = await getCurrentUser();
      }
      // Try refresh if token expired
      if (!user) {
        const refreshed = await refreshSession();
        if (refreshed) user = await getCurrentUser();
      }
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        dbGetAll()
          .then(data => { setProjects(data); setLoading(false); })
          .catch(e => { setError(e.message); setLoading(false); });
      }
    }
    init();

    // Auto-refresh token every 50 minutes to prevent JWT expiry
    const refreshInterval = setInterval(async () => {
      const { refreshSession } = await import("./auth");
      const refreshed = await refreshSession();
      if (!refreshed) {
        // Session truly expired, force re-login
        setCurrentUser(null);
        setProjects([]);
      }
    }, 50 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  const handleLogin = async () => {
    const user = await getCurrentUser();
    setCurrentUser(user);
    if (user) {
      dbGetAll()
        .then(data => { setProjects(data); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
    }
  };

  const handleLogout = async () => {
    await signOut();
    setCurrentUser(null);
    setProjects([]);
  };

  // Role helpers
  const isAdmin = currentUser?.profile?.role === "admin";
  const isEditor = currentUser?.profile?.role === "editor" || isAdmin;
  const isTrainer = currentUser?.profile?.role === "trainer" || isEditor;
  const canEdit = isEditor;
  const canDelete = isAdmin;
  const canTraining = isTrainer;

  const handleSaveProject = useCallback(async (updated) => {
    await dbUpsert(updated);
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  const handleAddProject = useCallback(async (proj) => {
    await dbUpsert(proj);
    setProjects(prev => [...prev, proj]);
    setShowAdd(false);
  }, []);

  const handleDeleteProject = useCallback(async (id) => {
    await dbDelete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setSelected(null);
  }, []);

  const selectedProject = projects.find(p => p.id === selected);
  const expiringSoon = projects.filter(p => { const d=getDaysRemaining(p.freeSupport.endDate); return d>=0&&d<=30; });

  // Auth loading
  if (authLoading) return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:40, height:40, border:"3px solid #1e293b", borderTop:"3px solid #38bdf8", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <div style={{ color:"#38bdf8", fontSize:16 }}>Memeriksa sesi...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Not logged in
  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
      <div style={{ width:40, height:40, border:"3px solid #1e293b", borderTop:"3px solid #38bdf8", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <div style={{ color:"#38bdf8", fontSize:16 }}>Memuat data dari Supabase...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#1c0a0a", border:"1px solid #ef4444", borderRadius:16, padding:32, maxWidth:400, textAlign:"center" }}>
        <div style={{ fontSize:32 }}>⚠️</div>
        <div style={{ color:"#ef4444", fontWeight:700, fontSize:18, marginTop:12 }}>Gagal terhubung ke database</div>
        <div style={{ color:"#64748b", fontSize:13, marginTop:8 }}>{error}</div>
        <button onClick={()=>window.location.reload()} style={{ ...BTN, marginTop:20 }}>Coba Lagi</button>
      </div>
    </div>
  );

  const toggleFilter = (key, val) => setFilters(f => ({ ...f, [key]: f[key] === val ? "all" : val }));

  const filteredProjects = projects.filter(p => {
    // Search by client name
    if (search && !p.client.toLowerCase().includes(search.toLowerCase())) return false;
    // Support filter
    if (filters.support !== "all") {
      const d = getDaysRemaining(p.freeSupport.endDate);
      if (filters.support === "expired" && d > 0) return false;
      if (filters.support === "warning" && (d <= 0 || d > 90)) return false;
      if (filters.support === "active" && d <= 90) return false;
    }
    // Implementation filter
    if (filters.impl !== "all") {
      const stages = p.implementation.stages;
      const allDone = stages.every(s => s.status === "done");
      const hasActive = stages.some(s => s.status === "in-progress");
      if (filters.impl === "done" && !allDone) return false;
      if (filters.impl === "running" && !hasActive) return false;
      if (filters.impl === "pending" && (allDone || hasActive)) return false;
    }
    // Server filter
    if (filters.server !== "all") {
      const hasServer = p.server && p.server.active;
      const svrExpiring = hasServer && p.server.endDate && getDaysRemaining(p.server.endDate) <= 30;
      if (filters.server === "active" && !hasServer) return false;
      if (filters.server === "none" && hasServer) return false;
      if (filters.server === "expiring" && !svrExpiring) return false;
    }
    return true;
  });

  const stats = [
    { label:"Total Proyek", val:projects.length, color:"#38bdf8", icon:"📁" },
    { label:"Perlu Perpanjang", val:projects.filter(p=>getDaysRemaining(p.freeSupport.endDate)<=90).length, color:"#f59e0b", icon:"🔔" },
    { label:"Server Aktif", val:projects.filter(p=>p.server&&p.server.active).length, color:"#10b981", icon:"🖥️" },
    { label:"Server Mau Habis", val:projects.filter(p=>p.server&&p.server.active&&p.server.endDate&&getDaysRemaining(p.server.endDate)<=30).length, color:"#ef4444", icon:"⚠️" },
  ];

  const [activePage, setActivePage] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sidebar nav structure
  const NAV = [
    {
      group: "UTAMA",
      items: [
        { id:"dashboard", icon:"🏠", label:"Dashboard", roles:["admin","editor","trainer","viewer"] },
      ]
    },
    {
      group: "INPUT DATA",
      items: [
        { id:"proyek_baru", icon:"➕", label:"Proyek Baru", roles:["admin","editor"] },
        { id:"jadwal", icon:"📅", label:"Jadwal Aktivitas", roles:["admin","editor","trainer"] },
        { id:"layanan", icon:"🔧", label:"Layanan Teknis", roles:["admin","editor","trainer"] },
        { id:"data_master", icon:"🗂", label:"Data Master", roles:["admin","editor"] },
      ]
    },
    {
      group: "LAPORAN",
      items: [
        { id:"laporan", icon:"📊", label:"Laporan Proyek", roles:["admin","editor"] },
        { id:"komisi", icon:"💰", label:"Komisi Layanan", roles:["admin","editor"] },
        { id:"kalender", icon:"🗓", label:"Kalender", roles:["admin","editor","trainer","viewer"] },
      ]
    },
    {
      group: "PENGATURAN",
      items: [
        { id:"users", icon:"👥", label:"Users", roles:["admin"] },
        { id:"roles", icon:"🔐", label:"Role & Akses", roles:["admin"] },
      ]
    },
  ];

  const userRole = currentUser?.profile?.role || "viewer";
  const visibleNav = NAV.map(g => ({
    ...g,
    items: g.items.filter(item => item.roles.includes(userRole))
  })).filter(g => g.items.length > 0);

  // Page router
  const renderPage = () => {
    if (activePage === "jadwal") return <ActivityPage onClose={()=>setActivePage("dashboard")} currentUser={currentUser} isAdmin={isAdmin} />;
    if (activePage === "laporan") return <LaporanModal projects={projects} onClose={()=>setActivePage("dashboard")} embedded={true} />;
    if (activePage === "komisi") return <KomisiPage onClose={()=>setActivePage("dashboard")} />;
    if (activePage === "kalender") return <CalendarPage onClose={()=>setActivePage("dashboard")} projects={projects} />;
    if (activePage === "data_master") return <MasterDataPage onClose={()=>setActivePage("dashboard")} isAdmin={isAdmin} />;
    if (activePage === "users") return <UserManager currentUser={currentUser} onClose={()=>setActivePage("dashboard")} />;
    if (activePage === "roles") return <RoleManagerPage onClose={()=>setActivePage("dashboard")} />;
    return null;
  };

  const fullPageRoutes = ["jadwal","laporan","komisi","kalender","data_master","users","roles"];
  const isFullPage = fullPageRoutes.includes(activePage);

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#060d1a", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif", color:"#e2e8f0" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box}::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:#0c1628}::-webkit-scrollbar-thumb{background:#1e3a5f;border-radius:3px}`}</style>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: sidebarCollapsed ? 64 : 220, flexShrink:0, background:"#080f1e",
        borderRight:"1px solid #1a2744", display:"flex", flexDirection:"column",
        transition:"width 0.2s", position:"sticky", top:0, height:"100vh", overflowY:"auto", overflowX:"hidden",
      }}>
        {/* Logo */}
        <div style={{ padding: sidebarCollapsed ? "20px 0" : "20px 16px", borderBottom:"1px solid #1a2744", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0, margin: sidebarCollapsed?"0 auto":0 }}>⚡</div>
          {!sidebarCollapsed && <div><div style={{ fontSize:14, fontWeight:800, color:"#f1f5f9", lineHeight:1.2 }}>Aktivity</div><div style={{ fontSize:10, color:"#475569", letterSpacing:1 }}>KGB</div></div>}
        </div>

        {/* Nav items */}
        <div style={{ flex:1, padding:"12px 8px", overflowY:"auto" }}>
          {visibleNav.map(group => (
            <div key={group.group} style={{ marginBottom:16 }}>
              {!sidebarCollapsed && <div style={{ fontSize:9, fontWeight:700, color:"#334155", letterSpacing:1.5, textTransform:"uppercase", padding:"0 8px", marginBottom:4 }}>{group.group}</div>}
              {group.items.map(item => {
                const isActive = activePage === item.id || (activePage === "proyek_baru" && item.id === "proyek_baru");
                return (
                  <button key={item.id} onClick={() => {
                    if (item.id === "proyek_baru") { setShowAdd(true); }
                    else setActivePage(item.id);
                  }} title={sidebarCollapsed ? item.label : ""} style={{
                    width:"100%", padding: sidebarCollapsed ? "10px 0" : "9px 10px",
                    borderRadius:8, border:"none", cursor:"pointer",
                    background: isActive ? "#0c2a3f" : "transparent",
                    color: isActive ? "#38bdf8" : "#475569",
                    display:"flex", alignItems:"center", gap:10,
                    justifyContent: sidebarCollapsed ? "center" : "flex-start",
                    fontSize:13, fontWeight: isActive ? 700 : 500,
                    marginBottom:2, transition:"all 0.15s",
                    borderLeft: isActive ? "3px solid #38bdf8" : "3px solid transparent",
                  }}
                    onMouseEnter={e=>{ if(!isActive){ e.currentTarget.style.background="#0a1525"; e.currentTarget.style.color="#94a3b8"; }}}
                    onMouseLeave={e=>{ if(!isActive){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#475569"; }}}>
                    <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
                    {!sidebarCollapsed && <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Collapse toggle */}
        <div style={{ padding:"12px 8px", borderTop:"1px solid #1a2744" }}>
          <button onClick={()=>setSidebarCollapsed(!sidebarCollapsed)} style={{
            width:"100%", padding:"8px", borderRadius:8, border:"none",
            background:"transparent", color:"#334155", cursor:"pointer", fontSize:16,
            display:"flex", alignItems:"center", justifyContent: sidebarCollapsed?"center":"flex-end",
          }}>
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflowX:"hidden" }}>
        {/* Top bar */}
        <div style={{ padding:"14px 24px", borderBottom:"1px solid #1a2744", display:"flex", justifyContent:"space-between", alignItems:"center", background:"#080f1e", position:"sticky", top:0, zIndex:100 }}>
          <div>
            <div style={{ fontSize:11, color:"#334155", letterSpacing:2, textTransform:"uppercase" }}>Activity KGB</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#f1f5f9", lineHeight:1.2 }}>
              {visibleNav.flatMap(g=>g.items).find(i=>i.id===activePage)?.label || "Dashboard"}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {expiringSoon.length > 0 && (
              <div style={{ padding:"6px 12px", background:"#1c0800", border:"1px solid #f59e0b44", borderRadius:8, fontSize:11, color:"#f59e0b", cursor:"pointer" }}
                onClick={()=>setActivePage("kalender")}>
                ⚠️ {expiringSoon.length} support hampir habis
              </div>
            )}
            <ProfileMenu currentUser={currentUser} onLogout={handleLogout} />
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex:1, padding: isFullPage ? 0 : "24px", overflowY:"auto" }}>
          {isFullPage ? renderPage() : (
            <>
              {/* Dashboard content */}
              {/* Server alert */}
              {(() => {
                const svrExpiring = projects.filter(p => p.server && p.server.active && p.server.endDate && getDaysRemaining(p.server.endDate) <= 30);
                return svrExpiring.length > 0 && (
                  <div style={{ background:"#0a0a1c", border:"1px solid #38bdf844", borderRadius:12, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:18 }}>🖥️</span>
                    <div>
                      <div style={{ fontWeight:700, color:"#38bdf8", fontSize:13 }}>Langganan Server Hampir Berakhir</div>
                      <div style={{ fontSize:12, color:"#475569" }}>{svrExpiring.map(p=>`${p.name} (${getDaysRemaining(p.server.endDate) <= 0 ? "Expired" : getDaysRemaining(p.server.endDate)+" hari lagi"})`).join(" · ")}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Support warning banner */}
              {expiringSoon.length > 0 && (
                <div style={{ background:"#1a0a00", border:"1px solid #f59e0b44", borderRadius:12, padding:"12px 16px", marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
                  <span style={{ fontSize:18 }}>⚠️</span>
                  <div>
                    <div style={{ fontWeight:700, color:"#f59e0b", fontSize:13 }}>Free Support Hampir Berakhir</div>
                    <div style={{ fontSize:12, color:"#92400e" }}>{expiringSoon.map(p=>`${p.client||p.name} (${getDaysRemaining(p.freeSupport.endDate)} hari lagi)`).join(" · ")}</div>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
                {[
                  { label:"Total Proyek", val:projects.length, color:"#38bdf8", icon:"📁" },
                  { label:"Perlu Perpanjang", val:projects.filter(p=>getDaysRemaining(p.freeSupport.endDate)<=90).length, color:"#f59e0b", icon:"🔔" },
                  { label:"Server Aktif", val:projects.filter(p=>p.server&&p.server.active).length, color:"#10b981", icon:"🖥️" },
                  { label:"Server Mau Habis", val:projects.filter(p=>p.server&&p.server.active&&p.server.endDate&&getDaysRemaining(p.server.endDate)<=30).length, color:"#ef4444", icon:"⚠️" },
                ].map(s=>(
                  <div key={s.label} style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:14, padding:"16px 18px" }}>
                    <div style={{ fontSize:20 }}>{s.icon}</div>
                    <div style={{ fontSize:28, fontWeight:900, color:s.color, lineHeight:1.1 }}>{s.val}</div>
                    <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Search + Filter */}
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                  <div style={{ position:"relative", flex:"1", minWidth:220 }}>
                    <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:14, color:"#475569" }}>🔍</span>
                    <input type="text" placeholder="Cari nama klien..." value={search} onChange={e=>setSearch(e.target.value)}
                      style={{ width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:10, padding:"9px 12px 9px 36px", color:"#e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" }} />
                    {search && <span onClick={()=>setSearch("")} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", cursor:"pointer", color:"#475569", fontSize:16 }}>✕</span>}
                  </div>
                  <FilterGroup label="🛡 Support" filterKey="support" current={filters.support} onToggle={toggleFilter} options={[["active","Aktif","#10b981","#052e16"],["warning","⚠️ Hampir Habis","#f59e0b","#451a03"],["expired","Expired","#ef4444","#450a0a"]]} />
                  <FilterGroup label="⚙️ Implementasi" filterKey="impl" current={filters.impl} onToggle={toggleFilter} options={[["running","Berjalan","#f59e0b","#451a03"],["done","Selesai","#10b981","#052e16"],["pending","Belum Mulai","#64748b","#0f172a"]]} />
                  <FilterGroup label="🖥 Server" filterKey="server" current={filters.server} onToggle={toggleFilter} options={[["active","Pakai Server","#38bdf8","#0c2a3f"],["none","No Server","#64748b","#0f172a"],["expiring","Mau Habis","#ef4444","#450a0a"]]} />
                  {(search || Object.values(filters).some(v=>v!=="all")) && (
                    <button onClick={()=>{setSearch("");setFilters({support:"all",impl:"all",server:"all"});}} style={{ padding:"8px 14px", borderRadius:8, fontSize:12, cursor:"pointer", border:"1px solid #334155", background:"transparent", color:"#64748b" }}>✕ Reset</button>
                  )}
                </div>
                {(search || Object.values(filters).some(v=>v!=="all")) && (
                  <div style={{ marginTop:8, fontSize:12, color:"#475569" }}>
                    Menampilkan <span style={{ color:"#38bdf8", fontWeight:600 }}>{filteredProjects.length}</span> dari {projects.length} proyek
                  </div>
                )}
              </div>

              {/* Project grid */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(400px,1fr))", gap:16 }}>
                {filteredProjects.map(proj=><ProjectCard key={proj.id} project={proj} onSelect={setSelected} />)}
              </div>
              {filteredProjects.length === 0 && (
                <div style={{ textAlign:"center", padding:"60px 20px", color:"#334155" }}>
                  <div style={{ fontSize:48 }}>📂</div>
                  <div style={{ fontSize:18, marginTop:12 }}>{search||Object.values(filters).some(v=>v!=="all")?"Tidak ada proyek yang cocok":"Belum ada proyek"}</div>
                  <div style={{ fontSize:13, marginTop:6 }}>{search||Object.values(filters).some(v=>v!=="all")?"Coba ubah filter":"Klik Proyek Baru di sidebar untuk mulai"}</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      {selected && (() => {
        const selectedProject = projects.find(p=>p.id===selected);
        return selectedProject && (
          <DetailView project={selectedProject} onClose={()=>setSelected(null)} onSave={canEdit?handleSaveProject:null} onDelete={canDelete?()=>handleDeleteProject(selectedProject.id):null} canEdit={canEdit} canDelete={canDelete} canTraining={canTraining} currentUser={currentUser} />
        );
      })()}
      {showAdd && canEdit && <AddProjectModal onClose={()=>setShowAdd(false)} onAdd={handleAddProject} />}
      {showUserMgr && isAdmin && <UserManager currentUser={currentUser} onClose={()=>setShowUserMgr(false)} />}
    </div>
  );
}
