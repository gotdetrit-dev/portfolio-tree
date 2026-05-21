import { useState } from 'react'
import { supabase } from '../supabaseClient.js'

// ─────────────────────────────────────────────────────────────────────────────
// Login — email/password sign in & sign up screen.
// On success, the auth listener in Root.jsx swaps this for the App.
// ─────────────────────────────────────────────────────────────────────────────

const ERROR_TH = {
  'Invalid login credentials': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  'User already registered': 'อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบ',
  'Password should be at least 6 characters': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
  'Email not confirmed': 'ยังไม่ได้ยืนยันอีเมล — ตรวจกล่องจดหมายของคุณ',
}

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const isSignup = mode === 'signup'

  async function submit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (isSignup) {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        if (!data.session) {
          setNotice('สมัครสำเร็จ — กรุณายืนยันอีเมลในกล่องจดหมายของคุณ แล้วกลับมาเข้าสู่ระบบ')
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (err) {
      setError(ERROR_TH[err.message] || err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 font-thai" style={{ color: 'var(--txt)' }}>
      <div className="panel rounded-3xl w-full max-w-[400px] p-7">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[18px]"
            style={{
              background: 'radial-gradient(circle at 40% 30%, rgba(52,224,122,0.4), transparent 60%)',
              border: '1px solid rgba(52,224,122,0.5)',
              boxShadow: '0 0 16px rgba(52,224,122,0.4)',
            }}
          >
            <span style={{ filter: 'drop-shadow(0 0 4px #34e07a)' }}>🌳</span>
          </div>
          <div>
            <div className="text-[18px] font-semibold tracking-tight" style={{ color: '#fff' }}>
              พอร์ต<span style={{ color: '#34e07a', textShadow: '0 0 10px rgba(52,224,122,0.55)' }}>ต้นไม้</span>
              <span className="text-[12px] font-normal text-[var(--txt-dim)]"> by หมอก๊อต</span>
            </div>
            <div className="text-[11px] text-[var(--txt-dim)]">{isSignup ? 'สร้างบัญชีใหม่' : 'เข้าสู่ระบบ'}</div>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="field-label">อีเมล</span>
            <input
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="field-label">รหัสผ่าน</span>
            <input
              type="password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="อย่างน้อย 6 ตัวอักษร"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={6}
              required
            />
          </label>

          {error && (
            <div className="text-[12px] rounded-lg px-3 py-2" style={{ color: '#ff8aa0', background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.3)' }}>
              {error}
            </div>
          )}
          {notice && (
            <div className="text-[12px] rounded-lg px-3 py-2" style={{ color: '#9bffae', background: 'rgba(52,224,122,0.08)', border: '1px solid rgba(52,224,122,0.3)' }}>
              {notice}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full" disabled={busy}>
            {busy ? 'กำลังดำเนินการ…' : isSignup ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="mt-4 text-center text-[12px] text-[var(--txt-dim)]">
          {isSignup ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'}{' '}
          <button
            type="button"
            className="underline hover:text-white transition-colors"
            onClick={() => { setMode(isSignup ? 'signin' : 'signup'); setError(''); setNotice('') }}
          >
            {isSignup ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </div>
      </div>
    </div>
  )
}
