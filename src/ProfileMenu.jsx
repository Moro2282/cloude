import { useState } from "react";
import { changePassword, signOut } from "./auth";

const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"9px 12px", color:"#e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };

const ROLE_COLOR = { admin:"#a78bfa", editor:"#38bdf8", trainer:"#f59e0b", viewer:"#64748b" };
const ROLE_LABEL = { admin:"Admin", editor:"Editor", trainer:"Trainer", viewer:"Viewer" };

export default function ProfileMenu({ currentUser, onLogout }) {
  const [open, setOpen] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [form, setForm] = useState({ current:"", newPass:"", confirm:"" });
  const [showPw, setShowPw] = useState({ current:false, newPass:false, confirm:false });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const role = currentUser?.profile?.role || "viewer";
  const name = currentUser?.profile?.full_name || currentUser?.email || "?";
  const email = currentUser?.email || "";
  const initial = name.charAt(0).toUpperCase();

  const notify = (text, type="success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleChangePassword = async () => {
    if (!form.newPass || !form.confirm) { notify("Password baru wajib diisi", "error"); return; }
    if (form.newPass.length < 6) { notify("Password minimal 6 karakter", "error"); return; }
    if (form.newPass !== form.confirm) { notify("Konfirmasi password tidak cocok", "error"); return; }
    setLoading(true);
    try {
      await changePassword(form.newPass);
      notify("Password berhasil diubah! ✓");
      setForm({ current:"", newPass:"", confirm:"" });
      setShowChangePass(false);
    } catch (e) {
      notify(e.message, "error");
    }
    setLoading(false);
  };

  const togglePw = (key) => setShowPw(p => ({ ...p, [key]: !p[key] }));

  return (
    <div style={{ position:"relative" }}>
      {/* Trigger button */}
      <div onClick={() => setOpen(!open)} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 14px", background:"#0c1628", border:`1px solid ${open?"#38bdf8":"#1a2744"}`, borderRadius:10, cursor:"pointer", transition:"border-color 0.2s", userSelect:"none" }}>
        <div style={{ width:30, height:30, borderRadius:"50%", background:`linear-gradient(135deg,#1d4ed8,#7c3aed)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:"#fff", flexShrink:0 }}>
          {initial}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:600, color:"#e2e8f0", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:120 }}>{name}</div>
          <div style={{ fontSize:10, color:ROLE_COLOR[role], fontWeight:700, textTransform:"uppercase", letterSpacing:0.5 }}>{ROLE_LABEL[role]}</div>
        </div>
        <span style={{ color:"#475569", fontSize:10, marginLeft:2 }}>{open?"▲":"▼"}</span>
      </div>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div style={{ position:"fixed", inset:0, zIndex:998 }} onClick={() => { setOpen(false); setShowChangePass(false); setMsg(null); }} />

          <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, background:"#0f172a", border:"1px solid #1e293b", borderRadius:14, padding:0, minWidth:280, zIndex:999, overflow:"hidden", boxShadow:"0 20px 60px #00000088" }}>

            {/* Profile header */}
            <div style={{ padding:"16px 18px", borderBottom:"1px solid #1e293b", background:"#0a1525" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:44, height:44, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, color:"#fff" }}>
                  {initial}
                </div>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:"#f1f5f9" }}>{name}</div>
                  <div style={{ fontSize:11, color:"#475569", marginTop:1 }}>{email}</div>
                  <span style={{ display:"inline-block", marginTop:4, padding:"2px 8px", borderRadius:999, fontSize:10, fontWeight:700, background:"#0c1628", color:ROLE_COLOR[role] }}>{ROLE_LABEL[role]}</span>
                </div>
              </div>
            </div>

            {/* Notification */}
            {msg && (
              <div style={{ margin:"10px 14px 0", padding:"8px 12px", borderRadius:8, fontSize:12, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>
                {msg.type==="error"?"⚠️":"✓"} {msg.text}
              </div>
            )}

            {/* Change password section */}
            <div style={{ padding:"8px 0" }}>
              {!showChangePass ? (
                <button onClick={() => setShowChangePass(true)} style={{ width:"100%", padding:"10px 18px", background:"transparent", border:"none", color:"#94a3b8", fontSize:13, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:10, transition:"background 0.15s" }}
                  onMouseEnter={e=>e.currentTarget.style.background="#0a1525"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  🔑 <span>Ganti Password</span>
                </button>
              ) : (
                <div style={{ padding:"10px 18px" }}>
                  <div style={{ fontSize:12, fontWeight:600, color:"#64748b", marginBottom:10, textTransform:"uppercase", letterSpacing:0.8 }}>Ganti Password</div>

                  {/* New password */}
                  <div style={{ marginBottom:10 }}>
                    <label style={{ fontSize:11, color:"#64748b" }}>Password Baru *</label>
                    <div style={{ position:"relative" }}>
                      <input type={showPw.newPass?"text":"password"} style={{ ...INP, paddingRight:36 }} placeholder="Min. 6 karakter" value={form.newPass} onChange={e=>setForm(f=>({...f,newPass:e.target.value}))} />
                      <span onClick={()=>togglePw("newPass")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-30%)", cursor:"pointer", color:"#475569", fontSize:14 }}>{showPw.newPass?"🙈":"👁"}</span>
                    </div>
                  </div>

                  {/* Confirm password */}
                  <div style={{ marginBottom:12 }}>
                    <label style={{ fontSize:11, color:"#64748b" }}>Konfirmasi Password *</label>
                    <div style={{ position:"relative" }}>
                      <input type={showPw.confirm?"text":"password"} style={{ ...INP, paddingRight:36, borderColor: form.confirm && form.newPass !== form.confirm ? "#ef4444" : "#1e293b" }} placeholder="Ulangi password baru" value={form.confirm} onChange={e=>setForm(f=>({...f,confirm:e.target.value}))} />
                      <span onClick={()=>togglePw("confirm")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-30%)", cursor:"pointer", color:"#475569", fontSize:14 }}>{showPw.confirm?"🙈":"👁"}</span>
                    </div>
                    {form.confirm && form.newPass !== form.confirm && (
                      <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>Password tidak cocok</div>
                    )}
                  </div>

                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={handleChangePassword} disabled={loading} style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:loading?"#1e293b":"#1d4ed8", color:loading?"#475569":"#fff", cursor:loading?"not-allowed":"pointer", fontWeight:600, fontSize:12 }}>
                      {loading?"Menyimpan...":"Simpan Password"}
                    </button>
                    <button onClick={()=>{setShowChangePass(false);setForm({current:"",newPass:"",confirm:""});}} style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:12 }}>Batal</button>
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height:1, background:"#1e293b", margin:"0 14px" }} />

            {/* Logout */}
            <div style={{ padding:"8px 0 4px" }}>
              <button onClick={onLogout} style={{ width:"100%", padding:"10px 18px", background:"transparent", border:"none", color:"#ef4444", fontSize:13, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:10, transition:"background 0.15s" }}
                onMouseEnter={e=>e.currentTarget.style.background="#1c0a0a"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                ⏏ <span>Keluar / Logout</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
