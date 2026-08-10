'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { Lock, Mail, RefreshCw, LogOut, BookOpen, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

interface AuthContextType {
  user: { id: string; email: string } | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refreshAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // States cho Form Login/Register
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const checkUserSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.user) {
          setUser(json.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUserSession();
  }, []);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setFormLoading(true);

    const url = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
      }

      if (isRegister) {
        setFormSuccess('Đăng ký tài khoản thành công! Đang tự động chuyển hướng đăng nhập...');
        // Tự động đăng nhập sau khi đăng ký thành công
        setTimeout(async () => {
          try {
            const loginRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            if (loginRes.ok) {
              const loginJson = await loginRes.json();
              setUser(loginJson.data);
              // Clear IndexedDB khi chuyển tài khoản mới
              if (typeof window !== 'undefined') {
                const { clearAllData } = await import('../lib/indexedDbHelper');
                await clearAllData();
              }
            }
          } catch (e) {
            setIsRegister(false);
            setFormSuccess('');
          } finally {
            setFormLoading(false);
          }
        }, 1500);
      } else {
        setUser(json.data);
        // Khi đăng nhập thành công, xóa sạch IndexedDB local cũ để sync dữ liệu từ cloud của user mới xuống
        if (typeof window !== 'undefined') {
          const { clearAllData } = await import('../lib/indexedDbHelper');
          await clearAllData();
        }
        setFormLoading(false);
      }
    } catch (err: any) {
      setFormError(err.message || 'Lỗi kết nối server.');
      setFormLoading(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đăng xuất? Dữ liệu local trên thiết bị sẽ được làm sạch để bảo mật.')) {
      return;
    }
    
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      // Xóa dữ liệu IndexedDB local
      if (typeof window !== 'undefined') {
        const { clearAllData } = await import('../lib/indexedDbHelper');
        await clearAllData();
      }
    } catch (e) {
      console.error('Lỗi khi đăng xuất:', e);
    } finally {
      setLoading(false);
    }
  };

  const refreshAuth = async () => {
    await checkUserSession();
  };

  // 1. LOADING SCREEN
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center space-y-4">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-slate-400 font-medium text-sm animate-pulse">Đang kiểm tra phiên đăng nhập...</p>
      </div>
    );
  }

  // 2. LOGIN / REGISTER SCREEN (PREMIUM DESIGN)
  if (!user) {
    return (
      <div className="min-h-screen w-full relative flex items-center justify-center p-4 overflow-hidden bg-slate-950">
        {/* Decorative dynamic circles */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/20 blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md z-10 space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400 mb-2">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">N1 Mastery 2026</h1>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">
              Ứng dụng học N1 & Ghi chú từ vựng cá nhân. Đăng nhập để đồng bộ dữ liệu.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">
                {isRegister ? 'Đăng ký tài khoản mới' : 'Chào mừng quay trở lại'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {isRegister ? 'Tạo tài khoản học tập để lưu trữ từ vựng trực tuyến' : 'Nhập thông tin tài khoản của bạn để tiếp tục'}
              </p>
            </div>

            {formError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 p-3.5 rounded-2xl text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-3.5 rounded-2xl text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    required
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/60 border border-white/10 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 rounded-2xl text-sm focus:outline-none text-white transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 bg-slate-900/60 border border-white/10 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 rounded-2xl text-sm focus:outline-none text-white transition-all placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-350 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={formLoading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {formLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isRegister ? 'Đăng ký ngay' : 'Đăng nhập'}
              </button>
            </form>

            <div className="text-center border-t border-white/5 pt-4">
              <button
                onClick={() => {
                  setIsRegister(!isRegister);
                  setFormError('');
                  setFormSuccess('');
                }}
                className="text-xs text-blue-400 font-bold hover:text-blue-300 transition-colors"
              >
                {isRegister ? 'Đã có tài khoản? Đăng nhập ngay' : 'Chưa có tài khoản? Đăng ký tại đây'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. MAIN APP LAYOUT WHEN LOGGED IN
  return (
    <AuthContext.Provider value={{ user, loading, logout: handleLogout, refreshAuth }}>
      <nav className="bg-slate-900 text-white shadow-md sticky top-0 z-50 border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-extrabold text-lg tracking-tight text-white hover:text-blue-400 transition-colors">
              🎓 N1 Mastery 2026
            </Link>
            <div className="hidden md:block text-xs font-semibold px-2.5 py-1 bg-slate-800 text-slate-400 rounded-full">
              Lộ trình 214 Ngày Đêm
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-400 font-medium">Tài khoản</p>
              <p className="text-xs text-slate-200 font-bold max-w-[150px] truncate">{user.email}</p>
            </div>
            
            <button
              onClick={handleLogout}
              className="p-2 bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700/60 hover:border-red-900 flex items-center gap-1.5 text-xs font-bold"
              title="Đăng xuất khỏi ứng dụng"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </nav>
      {children}
    </AuthContext.Provider>
  );
}
