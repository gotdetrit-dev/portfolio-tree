import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from './supabaseClient.js'
import Login from './components/Login.jsx'
import App from './App.jsx'

function Centered({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-thai" style={{ color: 'var(--txt)' }}>
      {children}
    </div>
  )
}

// Shown when the Supabase env vars are missing.
function SetupNotice() {
  return (
    <div className="panel rounded-3xl w-full max-w-[460px] p-7">
      <div className="text-[16px] font-semibold mb-2" style={{ color: '#f7c948' }}>ยังไม่ได้ตั้งค่าฐานข้อมูล</div>
      <div className="text-[13px] text-[var(--txt-dim)] leading-relaxed">
        สร้างไฟล์ <span className="font-mono text-white">.env.local</span> ในโฟลเดอร์โปรเจกต์ แล้วใส่ค่าจาก
        Supabase (Settings → API):
      </div>
      <pre className="mt-3 text-[12px] rounded-lg p-3 overflow-x-auto" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--line-strong)' }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxx`}
      </pre>
      <div className="text-[12px] text-[var(--txt-faint)] mt-3">จากนั้นรีสตาร์ท dev server</div>
    </div>
  )
}

export default function Root() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return <Centered><SetupNotice /></Centered>
  if (!ready) return <Centered><div className="text-[var(--txt-dim)] text-[13px]">กำลังเริ่มระบบ…</div></Centered>
  if (!session) return <Login />
  return <App user={session.user} onSignOut={() => supabase.auth.signOut()} />
}
