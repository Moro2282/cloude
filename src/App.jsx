import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

const STORAGE_KEY = "pm-dashboard-data";

// ─── EXCEL EXPORT ──────────────────────────────────────────────────────────────

function getStatusLabel(status) {
  return status === "done" ? "Selesai" : status === "in-progress" ? "Berjalan" : "Pending";
}

function getSupportStatus(days) {
  if (days <= 0) return "Expired";
  if (days <= 30) return "Kritis (≤30 hari)";
  if (days <= 90) return "Perhatian (≤90 hari)";
  return "Aktif";
}

function exportToExcel(projects) {
  const wb = XLSX.utils.book_new();
  const today = new Date().toLocaleDateString("id-ID");

  // Sheet 1 – Ringkasan Proyek
  const summaryRows = [
    ["LAPORAN RINGKASAN PROYEK"],
    [`Digenerate: ${today}`],
    [],
    ["No", "Nama Proyek", "Klien", "Email", "Tanggal Mulai",
     "Jam Training Total", "Jam Terpakai", "Jam Sisa", "% Training",
     "Desain Faktur Total", "Desain Terpakai", "Desain Sisa", "% Faktur",
     "Support Mulai", "Support Berakhir", "Sisa Hari Support", "Status Support", "Perpanjangan",
     "Tahap Selesai", "Total Tahap", "% Implementasi", "Status Aktif"],
  ];
  projects.forEach((p, i) => {
    const daysLeft = getDaysRemaining(p.freeSupport.endDate);
    const doneStages = p.implementation.stages.filter(s => s.status === "done").length;
    const totalStages = p.implementation.stages.length;
    const trainPct = Math.round((p.trainingHours.used / p.trainingHours.total) * 100);
    const invPct = Math.round((p.invoiceDesigns.used / p.invoiceDesigns.total) * 100);
    const implPct = Math.round((doneStages / totalStages) * 100);
    const activeStage = p.implementation.stages.find(s => s.status === "in-progress");
    summaryRows.push([
      i + 1, p.name, p.client, p.clientEmail, p.startDate,
      p.trainingHours.total, p.trainingHours.used,
      p.trainingHours.total - p.trainingHours.used, `${trainPct}%`,
      p.invoiceDesigns.total, p.invoiceDesigns.used,
      p.invoiceDesigns.total - p.invoiceDesigns.used, `${invPct}%`,
      p.freeSupport.startDate, p.freeSupport.endDate, daysLeft,
      getSupportStatus(daysLeft), p.freeSupport.renewals,
      doneStages, totalStages, `${implPct}%`,
      activeStage ? activeStage.name : (doneStages === totalStages ? "Selesai Semua" : "-"),
    ]);
  });
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 21 } }];
  ws1["!cols"] = [{ wch: 4 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 13 }, { wch: 14 }, { wch: 13 }, { wch: 9 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 11 }, { wch: 10 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 13 }, { wch: 13 }, { wch: 11 }, { wch: 14 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Ringkasan Proyek");

  // Sheet 2 – Detail Implementasi
  const implRows = [
    ["LAPORAN DETAIL IMPLEMENTASI"],
    [`Digenerate: ${today}`],
    [],
    ["Nama Proyek", "Klien", "No Tahap", "Nama Tahap", "Status", "Tanggal Selesai", "Catatan"],
  ];
  projects.forEach(p => {
    p.implementation.stages.forEach(s => {
      implRows.push([p.name, p.client, s.id, s.name, getStatusLabel(s.status), s.date || "-", s.notes || "-"]);
    });
    implRows.push([]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(implRows);
  ws2["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 9 }, { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Detail Implementasi");

  // Sheet 3 – Free Support
  const supportRows = [
    ["LAPORAN FREE SUPPORT"],
    [`Digenerate: ${today}`],
    [],
    ["Nama Proyek", "Klien", "Email", "Tanggal Mulai", "Tanggal Berakhir", "Sisa Hari", "Status", "Jumlah Perpanjangan"],
  ];
  projects.forEach(p => {
    const d = getDaysRemaining(p.freeSupport.endDate);
    supportRows.push([p.name, p.client, p.clientEmail, p.freeSupport.startDate, p.freeSupport.endDate, d, getSupportStatus(d), p.freeSupport.renewals]);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(supportRows);
  ws3["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 22 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Free Support");

  // Sheet 4 – Kuota Layanan
  const quotaRows = [
    ["LAPORAN KUOTA LAYANAN"],
    [`Digenerate: ${today}`],
    [],
    ["Nama Proyek", "Klien", "Jam Training Total", "Jam Training Terpakai", "Jam Training Sisa", "% Training", "Desain Faktur Total", "Desain Terpakai", "Desain Sisa", "% Faktur"],
  ];
  projects.forEach(p => {
    const tPct = ((p.trainingHours.used / p.trainingHours.total) * 100).toFixed(1);
    const iPct = ((p.invoiceDesigns.used / p.invoiceDesigns.total) * 100).toFixed(1);
    quotaRows.push([p.name, p.client, p.trainingHours.total, p.trainingHours.used, p.trainingHours.total - p.trainingHours.used, `${tPct}%`, p.invoiceDesigns.total, p.invoiceDesigns.used, p.invoiceDesigns.total - p.invoiceDesigns.used, `${iPct}%`]);
  });
  quotaRows.push([]);
  const tT = projects.reduce((a, p) => a + p.trainingHours.total, 0);
  const tU = projects.reduce((a, p) => a + p.trainingHours.used, 0);
  const iT = projects.reduce((a, p) => a + p.invoiceDesigns.total, 0);
  const iU = projects.reduce((a, p) => a + p.invoiceDesigns.used, 0);
  quotaRows.push(["TOTAL", `${projects.length} Proyek`, tT, tU, tT - tU, `${((tU / tT) * 100).toFixed(1)}%`, iT, iU, iT - iU, `${((iU / iT) * 100).toFixed(1)}%`]);
  const ws4 = XLSX.utils.aoa_to_sheet(quotaRows);
  ws4["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws4, "Kuota Layanan");

  XLSX.writeFile(wb, `Laporan_Proyek_${today.replace(/\//g, "-")}.xlsx`);
}

const defaultData = {
  projects: [
    {
      id: "proj-1",
      name: "PT Maju Bersama",
      client: "Budi Santoso",
      clientEmail: "budi@majubersama.com",
      startDate: "2025-01-15",
      trainingHours: { total: 40, used: 28 },
      invoiceDesigns: { total: 10, used: 7 },
      freeSupport: { startDate: "2025-01-15", endDate: "2026-01-15", renewals: 0 },
      implementation: {
        stages: [
          { id: 1, name: "Analisis Kebutuhan", status: "done", notes: "Selesai 20 Jan 2025. Semua requirement terdokumentasi.", date: "2025-01-20" },
          { id: 2, name: "Setup & Instalasi", status: "done", notes: "Server production sudah dikonfigurasi.", date: "2025-02-01" },
          { id: 3, name: "Training Tim", status: "done", notes: "Training modul 1-3 selesai. Modul 4 pending.", date: "2025-02-15" },
          { id: 4, name: "Uji Coba (UAT)", status: "in-progress", notes: "Sedang pengujian modul keuangan. Ditemukan 3 minor bug.", date: "" },
          { id: 5, name: "Go Live", status: "pending", notes: "", date: "" },
          { id: 6, name: "Post-Implementation Review", status: "pending", notes: "", date: "" },
        ],
      },
    },
    {
      id: "proj-2",
      name: "CV Sinar Abadi",
      client: "Dewi Rahayu",
      clientEmail: "dewi@sinarabadi.co.id",
      startDate: "2025-03-01",
      trainingHours: { total: 20, used: 5 },
      invoiceDesigns: { total: 5, used: 1 },
      freeSupport: { startDate: "2025-03-01", endDate: "2026-03-01", renewals: 0 },
      implementation: {
        stages: [
          { id: 1, name: "Analisis Kebutuhan", status: "done", notes: "Done.", date: "2025-03-10" },
          { id: 2, name: "Setup & Instalasi", status: "in-progress", notes: "Proses instalasi di server client.", date: "" },
          { id: 3, name: "Training Tim", status: "pending", notes: "", date: "" },
          { id: 4, name: "Uji Coba (UAT)", status: "pending", notes: "", date: "" },
          { id: 5, name: "Go Live", status: "pending", notes: "", date: "" },
          { id: 6, name: "Post-Implementation Review", status: "pending", notes: "", date: "" },
        ],
      },
    },
  ],
};

function getDaysRemaining(endDate) {
  const end = new Date(endDate);
  const now = new Date();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

function SupportBadge({ days }) {
  if (days <= 0) return <span style={badge("#450a0a","#ef4444","1px solid #ef444455")}>Expired</span>;
  if (days <= 30) return <span style={badge("#450a0a","#ef4444")}>{days} hari lagi</span>;
  if (days <= 90) return <span style={badge("#451a03","#f59e0b")}>{days} hari lagi</span>;
  return <span style={badge("#052e16","#10b981")}>{days} hari lagi</span>;
}

function badge(bg, color, border = "none") {
  return { padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color, border, whiteSpace: "nowrap" };
}

function ProgressBar({ value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const remaining = max - value;
  const barColor = pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : color || "#10b981";
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5, color: "#64748b" }}>
        <span>{value} terpakai</span>
        <span style={{ color: remaining <= 0 ? "#ef4444" : "#475569" }}>{remaining} sisa</span>
      </div>
      <div style={{ background: "#0f172a", borderRadius: 999, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, borderRadius: 999, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function StageIndicator({ stages }) {
  const statusColor = { done: "#10b981", "in-progress": "#f59e0b", pending: "#1e293b" };
  const labelMap = { done: "✓", "in-progress": "·", pending: "·" };
  const progress = stages.filter(s => s.status === "done").length;
  const current = stages.find(s => s.status === "in-progress") || stages.find(s => s.status === "pending");

  return (
    <div>
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 8 }}>
        {stages.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <div title={s.name} style={{
              width: 26, height: 26, borderRadius: "50%", background: statusColor[s.status],
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: "#fff", fontWeight: 800,
              border: s.status === "in-progress" ? "2px solid #fcd34d" : "2px solid transparent",
              boxShadow: s.status === "in-progress" ? "0 0 10px #f59e0b66" : "none",
              flexShrink: 0,
            }}>{labelMap[s.status]}</div>
            {i < stages.length - 1 && (
              <div style={{ width: 12, height: 2, background: s.status === "done" ? "#10b981" : "#0f172a", flexShrink: 0 }} />
            )}
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

function ProjectCard({ project, onSelect }) {
  const daysLeft = getDaysRemaining(project.freeSupport.endDate);
  const trainPct = Math.round((project.trainingHours.used / project.trainingHours.total) * 100);
  const invPct = Math.round((project.invoiceDesigns.used / project.invoiceDesigns.total) * 100);

  return (
    <div onClick={() => onSelect(project.id)} style={{
      background: "#0c1628", border: "1px solid #1a2744", borderRadius: 16, padding: 20,
      cursor: "pointer", transition: "border-color 0.2s, transform 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#2563eb"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a2744"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 2 }}>{project.name}</div>
          <div style={{ fontSize: 12, color: "#475569" }}>{project.client} · {project.clientEmail}</div>
        </div>
        <SupportBadge days={daysLeft} />
      </div>

      <StageIndicator stages={project.implementation.stages} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <div style={{ background: "#0a1525", border: "1px solid #1a2744", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.2 }}>Jam Training</div>
          <ProgressBar value={project.trainingHours.used} max={project.trainingHours.total} />
          <div style={{ fontSize: 20, fontWeight: 800, color: trainPct >= 90 ? "#ef4444" : "#38bdf8", marginTop: 6 }}>
            {project.trainingHours.total - project.trainingHours.used} <span style={{ fontSize: 11, fontWeight: 400, color: "#475569" }}>jam sisa</span>
          </div>
        </div>
        <div style={{ background: "#0a1525", border: "1px solid #1a2744", borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1.2 }}>Desain Faktur</div>
          <ProgressBar value={project.invoiceDesigns.used} max={project.invoiceDesigns.total} color="#a78bfa" />
          <div style={{ fontSize: 20, fontWeight: 800, color: invPct >= 90 ? "#ef4444" : "#a78bfa", marginTop: 6 }}>
            {project.invoiceDesigns.total - project.invoiceDesigns.used} <span style={{ fontSize: 11, fontWeight: 400, color: "#475569" }}>sisa</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#334155", textAlign: "right" }}>Klik untuk detail & edit →</div>
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000099", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 28, maxWidth: wide ? 900 : 700, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inp = { width: "100%", background: "#0c1628", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 14, marginTop: 4, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const miniCard = { background: "#0a1525", border: "1px solid #1a2744", borderRadius: 10, padding: 14 };

function DetailView({ project, onClose, onUpdate, onDelete }) {
  const [p, setP] = useState(JSON.parse(JSON.stringify(project)));
  const [activeTab, setActiveTab] = useState("overview");
  const [editStage, setEditStage] = useState(null);
  const [stageNote, setStageNote] = useState("");
  const [stageDate, setStageDate] = useState("");

  useEffect(() => { setP(JSON.parse(JSON.stringify(project))); }, [project.id]);

  const save = () => onUpdate(p);

  const updateField = (path, value) => {
    const parts = path.split(".");
    const updated = JSON.parse(JSON.stringify(p));
    let obj = updated;
    for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
    obj[parts[parts.length - 1]] = value;
    setP(updated);
  };

  const openStageEdit = (stage) => { setEditStage(stage.id); setStageNote(stage.notes); setStageDate(stage.date); };

  const saveStage = (stageId, newStatus) => {
    const updated = JSON.parse(JSON.stringify(p));
    const s = updated.implementation.stages.find(x => x.id === stageId);
    if (s) { s.notes = stageNote; s.date = stageDate; if (newStatus) s.status = newStatus; }
    setP(updated); setEditStage(null); onUpdate(updated);
  };

  const renewSupport = () => {
    const updated = JSON.parse(JSON.stringify(p));
    const end = new Date(updated.freeSupport.endDate);
    end.setFullYear(end.getFullYear() + 1);
    updated.freeSupport.endDate = end.toISOString().split("T")[0];
    updated.freeSupport.renewals += 1;
    setP(updated); onUpdate(updated);
  };

  const daysLeft = getDaysRemaining(p.freeSupport.endDate);
  const tabs = ["overview", "training", "faktur", "implementasi", "support"];
  const tabLabel = { overview: "Overview", training: "Jam Training", faktur: "Desain Faktur", implementasi: "Implementasi", support: "Free Support" };

  return (
    <Modal title={p.name} onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              padding: "6px 14px", borderRadius: 999, border: "1px solid",
              borderColor: activeTab === t ? "#38bdf8" : "#1e293b",
              background: activeTab === t ? "#0c4a6e" : "transparent",
              color: activeTab === t ? "#38bdf8" : "#64748b", fontSize: 12, cursor: "pointer",
            }}>{tabLabel[t]}</button>
          ))}
        </div>
        <button onClick={() => { if(window.confirm("Hapus proyek ini?")) onDelete(); }} style={{
          padding: "6px 14px", borderRadius: 8, border: "1px solid #7f1d1d",
          background: "#1c0a0a", color: "#ef4444", cursor: "pointer", fontSize: 12, fontWeight: 600,
        }}>🗑 Hapus Proyek</button>
      </div>

      {activeTab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            {[["client","Nama Klien","text"],["clientEmail","Email Klien","email"],["name","Nama Proyek","text"],["startDate","Tanggal Mulai","date"]].map(([k,label,type]) => (
              <div key={k} style={miniCard}>
                <label style={{ fontSize: 11, color: "#64748b" }}>{label}</label>
                <input type={type} style={inp} value={p[k]} onChange={e => updateField(k, e.target.value)} />
              </div>
            ))}
          </div>
          <button onClick={save} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Simpan Perubahan</button>
        </div>
      )}

      {activeTab === "training" && (
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>Atur kuota dan pemakaian jam training untuk project ini.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={miniCard}>
              <label style={{ fontSize: 11, color: "#64748b" }}>Total Jam (Kontrak)</label>
              <input type="number" style={inp} value={p.trainingHours.total} onChange={e => updateField("trainingHours.total", +e.target.value)} />
            </div>
            <div style={miniCard}>
              <label style={{ fontSize: 11, color: "#64748b" }}>Jam Terpakai</label>
              <input type="number" style={inp} value={p.trainingHours.used} onChange={e => updateField("trainingHours.used", +e.target.value)} />
            </div>
          </div>
          <div style={{ ...miniCard, marginBottom: 16 }}>
            <ProgressBar value={p.trainingHours.used} max={p.trainingHours.total} />
            <div style={{ marginTop: 12, display: "flex", gap: 20 }}>
              {[[p.trainingHours.total - p.trainingHours.used,"#38bdf8","jam tersisa"],[p.trainingHours.used,"#64748b","jam terpakai"],[p.trainingHours.total,"#94a3b8","total jam"]].map(([v,c,l]) => (
                <div key={l}><div style={{ fontSize: 26, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 11, color: "#475569" }}>{l}</div></div>
              ))}
            </div>
          </div>
          <button onClick={save} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Simpan</button>
        </div>
      )}

      {activeTab === "faktur" && (
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>Pantau sisa kuota desain faktur yang sudah digunakan.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={miniCard}>
              <label style={{ fontSize: 11, color: "#64748b" }}>Total Desain (Kontrak)</label>
              <input type="number" style={inp} value={p.invoiceDesigns.total} onChange={e => updateField("invoiceDesigns.total", +e.target.value)} />
            </div>
            <div style={miniCard}>
              <label style={{ fontSize: 11, color: "#64748b" }}>Desain Terpakai</label>
              <input type="number" style={inp} value={p.invoiceDesigns.used} onChange={e => updateField("invoiceDesigns.used", +e.target.value)} />
            </div>
          </div>
          <div style={{ ...miniCard, marginBottom: 16 }}>
            <ProgressBar value={p.invoiceDesigns.used} max={p.invoiceDesigns.total} color="#a78bfa" />
            <div style={{ marginTop: 12, display: "flex", gap: 20 }}>
              {[[p.invoiceDesigns.total - p.invoiceDesigns.used,"#a78bfa","desain tersisa"],[p.invoiceDesigns.used,"#64748b","sudah digunakan"]].map(([v,c,l]) => (
                <div key={l}><div style={{ fontSize: 26, fontWeight: 800, color: c }}>{v}</div><div style={{ fontSize: 11, color: "#475569" }}>{l}</div></div>
              ))}
            </div>
          </div>
          <button onClick={save} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Simpan</button>
        </div>
      )}

      {activeTab === "implementasi" && (
        <div>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>Klik tahap untuk edit status, catatan, dan tanggal penyelesaian.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {p.implementation.stages.map(stage => (
              <div key={stage.id} style={{ ...miniCard, borderLeft: `3px solid ${stage.status === "done" ? "#10b981" : stage.status === "in-progress" ? "#f59e0b" : "#334155"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: stage.status === "done" ? "#10b981" : stage.status === "in-progress" ? "#f59e0b" : "#475569", marginRight: 8 }}>
                      {stage.status === "done" ? "✓ Selesai" : stage.status === "in-progress" ? "● Berjalan" : "○ Pending"}
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
                      <textarea style={{ ...inp, resize: "vertical" }} rows={3} value={stageNote} onChange={e => setStageNote(e.target.value)} placeholder="Tambahkan catatan..." />
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>Tanggal Selesai</label>
                      <input type="date" style={inp} value={stageDate} onChange={e => setStageDate(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {[["done","#065f46","#10b981","✓ Tandai Selesai"],["in-progress","#78350f","#f59e0b","● Set Berjalan"],["pending","#1e293b","#94a3b8","○ Set Pending"]].map(([st,bg,color,label]) => (
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
          <div style={{ ...miniCard, background: daysLeft <= 0 ? "#1c0a0a" : daysLeft <= 30 ? "#1c0f00" : "#0a1a0a", borderColor: daysLeft <= 0 ? "#ef4444" : daysLeft <= 30 ? "#f59e0b" : "#10b981", borderStyle: "solid", borderWidth: 1, marginBottom: 16 }}>
            <div style={{ fontSize: 38, fontWeight: 900, color: daysLeft <= 0 ? "#ef4444" : daysLeft <= 30 ? "#f59e0b" : "#10b981" }}>
              {daysLeft <= 0 ? "Expired" : `${daysLeft} hari`}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
              {daysLeft <= 0 ? "Free support sudah berakhir" : "tersisa sebelum free support berakhir"}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>
              Mulai: {p.freeSupport.startDate} · Berakhir: {p.freeSupport.endDate} · Diperpanjang: {p.freeSupport.renewals}x
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={miniCard}>
              <label style={{ fontSize: 11, color: "#64748b" }}>Tanggal Mulai Support</label>
              <input type="date" style={inp} value={p.freeSupport.startDate} onChange={e => updateField("freeSupport.startDate", e.target.value)} />
            </div>
            <div style={miniCard}>
              <label style={{ fontSize: 11, color: "#64748b" }}>Tanggal Berakhir Support</label>
              <input type="date" style={inp} value={p.freeSupport.endDate} onChange={e => updateField("freeSupport.endDate", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={save} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Simpan Perubahan</button>
            <button onClick={renewSupport} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #10b981", background: "#052e16", color: "#10b981", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>🔄 Perpanjang +1 Tahun</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function LaporanModal({ projects, onClose }) {
  const [selected, setSelected] = useState(projects.map(p => p.id));
  const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = () => setSelected(selected.length === projects.length ? [] : projects.map(p => p.id));
  const filtered = projects.filter(p => selected.includes(p.id));

  const statCards = [
    { label: "Proyek Dipilih", val: filtered.length, color: "#38bdf8" },
    { label: "Total Jam Training", val: filtered.reduce((a, p) => a + p.trainingHours.total, 0), color: "#10b981", unit: "jam" },
    { label: "Total Desain Faktur", val: filtered.reduce((a, p) => a + p.invoiceDesigns.total, 0), color: "#a78bfa", unit: "desain" },
    { label: "Support Kritis", val: filtered.filter(p => getDaysRemaining(p.freeSupport.endDate) <= 30).length, color: "#ef4444" },
  ];

  return (
    <Modal title="📊 Modul Laporan & Export Excel" onClose={onClose} wide>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {statCards.map(s => (
          <div key={s.label} style={{ background: "#0a1525", border: "1px solid #1a2744", borderRadius: 10, padding: "12px 14px" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}{s.unit && <span style={{ fontSize: 11, color: "#475569", fontWeight: 400, marginLeft: 4 }}>{s.unit}</span>}</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Pilih Proyek yang Akan Dilaporkan</div>
          <button onClick={toggleAll} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, border: "1px solid #334155", background: "transparent", color: "#64748b", cursor: "pointer" }}>
            {selected.length === projects.length ? "Batalkan Semua" : "Pilih Semua"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {projects.map(p => {
            const days = getDaysRemaining(p.freeSupport.endDate);
            const done = p.implementation.stages.filter(s => s.status === "done").length;
            const isChecked = selected.includes(p.id);
            return (
              <div key={p.id} onClick={() => toggle(p.id)} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 16px",
                background: isChecked ? "#0d1f38" : "#0a1525",
                border: `1px solid ${isChecked ? "#1d4ed8" : "#1a2744"}`,
                borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
              }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isChecked ? "#3b82f6" : "#334155"}`, background: isChecked ? "#1d4ed8" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{isChecked ? "✓" : ""}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "#e2e8f0", fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{p.client} · {p.clientEmail}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <span style={badge("#0c1628","#38bdf8")}>{p.trainingHours.total - p.trainingHours.used} jam sisa</span>
                  <span style={badge("#0c1628","#a78bfa")}>{p.invoiceDesigns.total - p.invoiceDesigns.used} desain sisa</span>
                  <SupportBadge days={days} />
                  <span style={badge("#0c1628","#64748b")}>{done}/{p.implementation.stages.length} tahap</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "#0a1525", border: "1px solid #1a2744", borderRadius: 10, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>4 Sheet Excel yang Akan Digenerate</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["📋","Ringkasan Proyek","Semua data proyek dalam 1 tabel utama"],
            ["🔧","Detail Implementasi","Status & catatan per tahap implementasi"],
            ["🛡️","Free Support","Sisa hari & status support per proyek"],
            ["📦","Kuota Layanan","Pemakaian jam training & desain faktur + total keseluruhan"],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={() => { if (filtered.length > 0) exportToExcel(filtered); }} disabled={filtered.length === 0} style={{
          padding: "12px 28px", borderRadius: 8, border: "none",
          background: filtered.length === 0 ? "#1e293b" : "#059669",
          color: filtered.length === 0 ? "#334155" : "#fff",
          cursor: filtered.length === 0 ? "not-allowed" : "pointer",
          fontWeight: 700, fontSize: 14,
        }}>
          ⬇️ Export Excel ({filtered.length} proyek)
        </button>
        <div style={{ fontSize: 11, color: "#334155" }}>Laporan_Proyek_{today.replace(/ /g, "_")}.xlsx</div>
      </div>
    </Modal>
  );
}

function AddProjectModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", client: "", clientEmail: "", startDate: new Date().toISOString().split("T")[0], trainTotal: 40, invTotal: 10 });

  const submit = () => {
    if (!form.name || !form.client) return;
    const end = new Date(form.startDate);
    end.setFullYear(end.getFullYear() + 1);
    onAdd({
      id: "proj-" + Date.now(), name: form.name, client: form.client, clientEmail: form.clientEmail, startDate: form.startDate,
      trainingHours: { total: +form.trainTotal, used: 0 }, invoiceDesigns: { total: +form.invTotal, used: 0 },
      freeSupport: { startDate: form.startDate, endDate: end.toISOString().split("T")[0], renewals: 0 },
      implementation: { stages: [
        { id: 1, name: "Analisis Kebutuhan", status: "pending", notes: "", date: "" },
        { id: 2, name: "Setup & Instalasi", status: "pending", notes: "", date: "" },
        { id: 3, name: "Training Tim", status: "pending", notes: "", date: "" },
        { id: 4, name: "Uji Coba (UAT)", status: "pending", notes: "", date: "" },
        { id: 5, name: "Go Live", status: "pending", notes: "", date: "" },
        { id: 6, name: "Post-Implementation Review", status: "pending", notes: "", date: "" },
      ]},
    });
  };

  const f = (k, v) => setForm(x => ({ ...x, [k]: v }));
  const fields = [["name","Nama Proyek","text"],["client","Nama Klien","text"],["clientEmail","Email Klien","email"],["startDate","Tanggal Mulai","date"],["trainTotal","Total Jam Training","number"],["invTotal","Total Desain Faktur","number"]];

  return (
    <Modal title="Tambah Proyek Baru" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {fields.map(([k, label, type]) => (
          <div key={k} style={miniCard}>
            <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
            <input type={type} style={inp} value={form[k]} onChange={e => f(k, e.target.value)} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button onClick={submit} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>Tambah Proyek</button>
        <button onClick={onClose} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #334155", background: "transparent", color: "#64748b", cursor: "pointer" }}>Batal</button>
      </div>
    </Modal>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showLaporan, setShowLaporan] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      setData(raw ? JSON.parse(raw) : defaultData);
    } catch {
      setData(defaultData);
    }
    setLoading(false);
  }, []);

  const persist = (newData) => {
    setData(newData);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newData)); } catch { }
  };

  const updateProject = (updated) => persist({ ...data, projects: data.projects.map(p => p.id === updated.id ? updated : p) });
  const addProject = (proj) => { persist({ ...data, projects: [...data.projects, proj] }); setShowAdd(false); };
  const deleteProject = (id) => { if (!window.confirm("Hapus proyek ini?")) return; persist({ ...data, projects: data.projects.filter(p => p.id !== id) }); setSelected(null); };

  const selectedProject = data?.projects.find(p => p.id === selected);
  const expiringSoon = data?.projects.filter(p => { const d = getDaysRemaining(p.freeSupport.endDate); return d >= 0 && d <= 30; }) || [];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#060d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#38bdf8", fontSize: 18 }}>Memuat data...</div>
    </div>
  );

  const stats = [
    { label: "Total Proyek", val: data.projects.length, color: "#38bdf8", icon: "📁" },
    { label: "Perlu Perpanjang", val: data.projects.filter(p => getDaysRemaining(p.freeSupport.endDate) <= 90).length, color: "#f59e0b", icon: "🔔" },
    { label: "Go Live", val: data.projects.filter(p => p.implementation.stages.find(s => s.name === "Go Live")?.status === "done").length, color: "#10b981", icon: "🚀" },
    { label: "Berjalan", val: data.projects.filter(p => p.implementation.stages.some(s => s.status === "in-progress")).length, color: "#a78bfa", icon: "⚡" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", padding: "24px 20px", fontFamily: "'Plus Jakarta Sans', 'Segoe UI', sans-serif", color: "#e2e8f0" }}>
      <style>{`*, *::before, *::after { box-sizing: border-box; } ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0c1628; } ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 3px; }`}</style>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#334155", letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>Project Management</div>
            <h1 style={{ fontSize: 34, fontWeight: 900, color: "#f1f5f9", lineHeight: 1, margin: 0 }}>Dashboard Proyek</h1>
            <div style={{ fontSize: 14, color: "#475569", marginTop: 6 }}>{data.projects.length} proyek aktif · Pantau progress & sisa layanan</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowLaporan(true)} style={{ padding: "12px 20px", borderRadius: 8, border: "1px solid #059669", background: "#052e16", color: "#10b981", cursor: "pointer", fontWeight: 600, fontSize: 14 }}>
              📊 Laporan Excel
            </button>
            <button onClick={() => setShowAdd(true)} style={{ padding: "12px 24px", borderRadius: 8, border: "none", background: "#1d4ed8", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 15 }}>+ Proyek Baru</button>
          </div>
        </div>

        {/* Alert */}
        {expiringSoon.length > 0 && (
          <div style={{ background: "#1c0800", border: "1px solid #f59e0b44", borderRadius: 12, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 700, color: "#f59e0b", fontSize: 14 }}>Free Support Hampir Berakhir</div>
              <div style={{ fontSize: 12, color: "#78716c" }}>{expiringSoon.map(p => `${p.name} (${getDaysRemaining(p.freeSupport.endDate)} hari lagi)`).join(" · ")}</div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: "#0c1628", border: "1px solid #1a2744", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 22 }}>{s.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.val}</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 16 }}>
          {data.projects.map(proj => <ProjectCard key={proj.id} project={proj} onSelect={setSelected} />)}
        </div>

        {data.projects.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#334155" }}>
            <div style={{ fontSize: 48 }}>📂</div>
            <div style={{ fontSize: 18, marginTop: 12 }}>Belum ada proyek</div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Klik "+ Proyek Baru" untuk mulai</div>
          </div>
        )}
      </div>

      {selectedProject && (
        <DetailView
          project={selectedProject}
          onClose={() => setSelected(null)}
          onUpdate={updateProject}
          onDelete={() => deleteProject(selectedProject.id)}
        />
      )}

      {showAdd && <AddProjectModal onClose={() => setShowAdd(false)} onAdd={addProject} />}
      {showLaporan && <LaporanModal projects={data.projects} onClose={() => setShowLaporan(false)} />}
    </div>
  );
}
