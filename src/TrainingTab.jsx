import { useState, useEffect } from "react";

const SUPABASE_URL = "https://kfhbrodsgurvrsfpecwq.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaGJyb2RzZ3VydnJzZnBlY3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDk1NDUsImV4cCI6MjA5NjAyNTU0NX0.KPN4fUHzVUyVL4_vkh_zDO6Y-XAwTLi8FPKiln8nJwQ";
const TRAIN_API = `${SUPABASE_URL}/rest/v1/training_sessions`;

function getToken() {
  try { return JSON.parse(localStorage.getItem("sb_session"))?.access_token || SUPABASE_KEY; }
  catch { return SUPABASE_KEY; }
}

function hdrs() {
  return {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${getToken()}`,
    "Prefer": "return=representation",
  };
}

async function getSessions(projectId) {
  const res = await fetch(`${TRAIN_API}?project_id=eq.${projectId}&order=training_date.desc`, { headers: hdrs() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function addSession(session) {
  const res = await fetch(TRAIN_API, { method: "POST", headers: hdrs(), body: JSON.stringify(session) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function deleteSession(id) {
  const res = await fetch(`${TRAIN_API}?id=eq.${id}`, { method: "DELETE", headers: hdrs() });
  if (!res.ok) throw new Error(await res.text());
}

const INP = { width: "100%", background: "#0c1628", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 10px", color: "#e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginTop: 4 };
const MINI = { background: "#0a1525", border: "1px solid #1a2744", borderRadius: 10, padding: 14 };

export default function TrainingTab({ project, canEdit, canTraining, canDelete, currentUser, onUpdateHours, onSave }) {
  const [subTab, setSubTab] = useState("histori");
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    training_date: new Date().toISOString().split("T")[0],
    trainer_name: currentUser?.profile?.full_name || "",
    participants: "",
    topics: "",
    start_time: "08:00",
    end_time: "10:00",
    use_vehicle: false,
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

  useEffect(() => { loadSessions(); }, [project.id]);

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

  const totalUsedFromHistory = sessions.reduce((a, s) => a + parseFloat(s.hours_used || 0), 0);

  const handleAdd = async () => {
    if (!form.training_date || !form.trainer_name || !form.participants || !form.topics || !form.start_time || !form.end_time) {
      notify("Semua field wajib diisi kecuali catatan", "error"); return;
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
        trainer_name: form.trainer_name,
        participants: form.participants,
        topic: form.topics,
        hours_used: hrs,
        start_time: form.start_time,
        end_time: form.end_time,
        use_vehicle: form.use_vehicle,
        notes: form.notes,
        created_by: currentUser?.id || null,
      };
      const [saved] = await addSession(newSession);
      setSessions(prev => [saved, ...prev]);

      // Update project training hours
      const newUsed = totalUsedFromHistory + hrs;
      await onUpdateHours(project.trainingHours.total, newUsed);
      await onSave({ ...project, trainingHours: { ...project.trainingHours, used: newUsed } });

      setForm({ training_date: new Date().toISOString().split("T")[0], trainer_name: currentUser?.profile?.full_name || "", participants: "", topics: "", start_time: "08:00", end_time: "10:00", use_vehicle: false, notes: "" });
      setShowForm(false);
      notify(`Sesi training berhasil dicatat! ${hrs} jam dikurangi dari kuota.`);
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
                    {/* Row 1: Tanggal & Trainer */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: "#64748b" }}>Tanggal Training *</label>
                        <input type="date" style={INP} value={form.training_date} onChange={e => setForm(f => ({ ...f, training_date: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: "#64748b" }}>Nama Trainer *</label>
                        <input type="text" style={INP} placeholder="Nama yang melatih" value={form.trainer_name} onChange={e => setForm(f => ({ ...f, trainer_name: e.target.value }))} />
                      </div>
                    </div>

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
                        <span style={{ padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: "#0c2a3f", color: "#38bdf8" }}>⏱ {s.hours_used} jam</span>
                        {s.start_time && s.end_time && (
                          <span style={{ fontSize: 11, color: "#475569" }}>🕐 {s.start_time} – {s.end_time}</span>
                        )}
                        <span style={{ fontSize: 11, color: "#475569" }}>📅 {s.training_date}</span>
                        {s.use_vehicle && <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: "#052e16", color: "#10b981" }}>🚗 Kendaraan Pribadi</span>}
                      </div>
                      {/* Details grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          <span style={{ color: "#475569" }}>👤 Trainer: </span>{s.trainer_name}
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          <span style={{ color: "#475569" }}>👥 Peserta: </span>{s.participants}
                        </div>
                      </div>
                      {/* Topic - multiline */}
                      <div style={{ background: "#060d1a", border: "1px solid #1e293b", borderRadius: 6, padding: "8px 10px", marginBottom: s.notes ? 8 : 0 }}>
                        <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>📚 Materi Training:</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{s.topic}</div>
                      </div>
                      {s.notes && (
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                          <span style={{ color: "#475569" }}>📝 </span>{s.notes}
                        </div>
                      )}
                    </div>
                    {/* Delete button - admin only */}
                    {canDelete && (
                      <button onClick={() => handleDelete(s)} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #7f1d1d", background: "#1c0a0a", color: "#ef4444", cursor: "pointer", fontSize: 11, flexShrink: 0 }}>🗑</button>
                    )}
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
  );
}
