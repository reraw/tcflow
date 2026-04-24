import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'

export default function Login() {
  const { user, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgot, setIsForgot] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      if (isSignUp) {
        await signUp(email, password)
        setMessage('Check your email for a confirmation link.')
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setMessage('Check your email for a password reset link.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inp = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-primary">TCFlow</h1>
          <p className="text-sm text-gray-500 mt-1">Transaction Coordinator Deal Tracker</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">
            {isForgot ? 'Reset Password' : isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          {isForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className={inp} value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
              {message && <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{message}</div>}

              <button type="submit" disabled={loading} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <div className="text-center">
                <button type="button" onClick={() => { setIsForgot(false); setError(''); setMessage('') }} className="text-sm text-indigo-primary hover:text-indigo-700">
                  Back to sign in
                </button>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" className={inp} value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" className={inp} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                  {!isSignUp && (
                    <div className="mt-1 text-right">
                      <button type="button" onClick={() => { setIsForgot(true); setError(''); setMessage('') }} className="text-xs text-indigo-primary hover:text-indigo-700">
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>

                {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
                {message && <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{message}</div>}

                <button type="submit" disabled={loading} className="w-full px-4 py-2.5 text-sm font-medium text-white bg-indigo-primary rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                  {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }} className="text-sm text-indigo-primary hover:text-indigo-700">
                  {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
