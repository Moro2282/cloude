import { useState } from "react";

const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"9px 12px", color:"#e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginTop:4 };

export default function ResetPasswordModal({ user, onClose, onReset }) {
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const handleReset = async () => {
    if (!newPass) { setMsg({ text:"Password baru wajib diisi", type:"error" }); return; }
    if (newPass.length < 6) { setMsg({ text:"Password minimal 6 karakter", type:"error" }); return; }
    if (newPass !== confirm) { setMsg({ text:"Konfirmasi password tidak cocok", type:"error" }); return; }
    setLoading(true);
    try {
      await onReset(user.id, user.email, newPass);
      setMsg({ text:`Password ${user.full_name || user.email} berhasil direset!`, type:"success" });
      setTimeout(onClose, 1500);
    } catch (e) {
      setMsg({ text:e.message, type:"error" });
    }
    setLoading(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#00000088", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:"#0f172a", border:"1px solid #1e293b", borderRadius:16, padding:28, maxWidth:400, width:"100%", fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontSize:16, fontWeight:700, color:"#f1f5f9" }}>🔑 Reset Password</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>

        {/* User info */}
        <div style={{ background:"#0a1525", border:"1px solid #1a2744", borderRadius:10, padding:"12px 14px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, color:"#fff" }}>
            {(user.full_name||user.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:"#e2e8f0" }}>{user.full_name || "—"}</div>
            <div style={{ fontSize:11, color:"#475569" }}>{user.email}</div>
          </div>
        </div>

        {msg && (
          <div style={{ padding:"9px 12px", borderRadius:8, marginBottom:14, fontSize:13, background:msg.type==="error"?"#1c0a0a":"#052e16", color:msg.type==="error"?"#ef4444":"#10b981", border:`1px solid ${msg.type==="error"?"#ef444433":"#10b98133"}` }}>
            {msg.type==="error"?"⚠️":"✓"} {msg.text}
          </div>
        )}

        <div style={{ marginBottom:12 }}>
          <label style={{ fontSize:11, color:"#64748b" }}>Password Baru *</label>
          <div style={{ position:"relative" }}>
            <input type={showPw?"text":"password"} style={{ ...INP, paddingRight:36 }} placeholder="Min. 6 karakter" value={newPass} onChange={e=>setNewPass(e.target.value)} autoFocus />
            <span onClick={()=>setShowPw(!showPw)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-20%)", cursor:"pointer", color:"#475569", fontSize:14 }}>{showPw?"🙈":"👁"}</span>
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={{ fontSize:11, color:"#64748b" }}>Konfirmasi Password *</label>
          <input type="password" style={{ ...INP, borderColor: confirm && newPass !== confirm ? "#ef4444" : "#1e293b" }} placeholder="Ulangi password baru" value={confirm} onChange={e=>setConfirm(e.target.value)} />
          {confirm && newPass !== confirm && <div style={{ fontSize:11, color:"#ef4444", marginTop:4 }}>Password tidak cocok</div>}
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={handleReset} disabled={loading} style={{ flex:1, padding:"10px", borderRadius:8, border:"none", background:loading?"#1e293b":"#1d4ed8", color:loading?"#475569":"#fff", cursor:loading?"not-allowed":"pointer", fontWeight:600, fontSize:14 }}>
            {loading?"Menyimpan...":"Reset Password"}
          </button>
          <button onClick={onClose} style={{ padding:"10px 16px", borderRadius:8, border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer" }}>Batal</button>
        </div>

        <div style={{ marginTop:14, fontSize:11, color:"#334155", textAlign:"center" }}>
          Informasikan password baru ke user secara langsung
        </div>
      </div>
    </div>
  );
}
