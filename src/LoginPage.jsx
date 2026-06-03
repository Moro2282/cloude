import { useState } from "react";
import { signInEmail, signInGoogle } from "./auth";

const INP = { width:"100%", background:"#0c1628", border:"1px solid #1e293b", borderRadius:8, padding:"10px 14px", color:"#e2e8f0", fontSize:14, outline:"none", fontFamily:"inherit", boxSizing:"border-box" };

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleEmail = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError("Email dan password wajib diisi"); return; }
    setLoading(true); setError("");
    try {
      const session = await signInEmail(email, password);
      onLogin(session);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center", padding:20, fontFamily:"'Plus Jakarta Sans','Segoe UI',sans-serif" }}>
      <style>{`*,*::before,*::after{box-sizing:border-box} input::placeholder{color:#334155}`}</style>
      <div style={{ width:"100%", maxWidth:420 }}>

        {/* Logo / Header */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:"linear-gradient(135deg,#1d4ed8,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, margin:"0 auto 16px" }}>📊</div>
          <h1 style={{ fontSize:26, fontWeight:900, color:"#f1f5f9", margin:0 }}>Dashboard Proyek</h1>
          <p style={{ color:"#475569", fontSize:14, marginTop:8 }}>Masuk untuk melanjutkan</p>
        </div>

        {/* Card */}
        <div style={{ background:"#0c1628", border:"1px solid #1a2744", borderRadius:20, padding:32 }}>

          {/* Google login */}
          <button onClick={signInGoogle} style={{ width:"100%", padding:"11px 16px", borderRadius:10, border:"1px solid #1e293b", background:"#0a1525", color:"#e2e8f0", fontSize:14, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:24, transition:"border-color 0.2s" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#4285f4"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="#1e293b"}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20c11 0 19.7-7.7 19.7-20 0-1.3-.1-2.7-.2-3z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.7 0-14.3 4.5-17.7 11.7z"/><path fill="#FBBC05" d="M24 43c5.9 0 10.9-2 14.6-5.3l-6.7-5.5C29.9 34.1 27.1 35 24 35c-6 0-11.1-4-12.9-9.5l-7 5.4C7.8 38.7 15.4 43 24 43z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.8c-.8 2.3-2.3 4.3-4.3 5.7l6.7 5.5C42.1 36.2 44.5 30 44.5 23c0-1-.1-2-.2-3z"/></svg>
            Masuk dengan Google
          </button>

          {/* Divider */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
            <div style={{ flex:1, height:1, background:"#1e293b" }} />
            <span style={{ fontSize:12, color:"#334155" }}>atau dengan email</span>
            <div style={{ flex:1, height:1, background:"#1e293b" }} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ background:"#1c0a0a", border:"1px solid #ef444433", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:13, color:"#ef4444" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmail}>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Email</label>
              <input type="email" style={INP} placeholder="nama@email.com" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ fontSize:12, color:"#64748b", display:"block", marginBottom:6 }}>Password</label>
              <div style={{ position:"relative" }}>
                <input type={showPass?"text":"password"} style={{ ...INP, paddingRight:44 }} placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" />
                <span onClick={()=>setShowPass(!showPass)} style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", cursor:"pointer", fontSize:16, color:"#475569", userSelect:"none" }}>
                  {showPass ? "🙈" : "👁"}
                </span>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background: loading?"#1e3a5f":"#1d4ed8", color:"#fff", fontSize:15, fontWeight:700, cursor: loading?"not-allowed":"pointer", transition:"background 0.2s" }}>
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </div>

        <p style={{ textAlign:"center", fontSize:12, color:"#1e293b", marginTop:24 }}>
          Belum punya akun? Hubungi administrator.
        </p>
      </div>
    </div>
  );
}
