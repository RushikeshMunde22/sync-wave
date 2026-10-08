import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface GoogleLoginButtonProps {
  redirectUrl?: string | null;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export function GoogleLoginButton({ redirectUrl, text = 'continue_with' }: GoogleLoginButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState(false);
  const navigate = useNavigate();
  const { fetchUser } = useAuthStore();

  // 1. Fetch public Google Client ID configuration
  useEffect(() => {
    let isMounted = true;
    const loadConfig = async () => {
      try {
        const res = await fetch('/api/auth/config');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.googleClientId) {
            setGoogleClientId(data.googleClientId);
            return;
          }
        }
      } catch {}

      // Fallback to Vite env var if provided
      const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
      if (isMounted && envClientId) {
        setGoogleClientId(envClientId);
      }
    };

    loadConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Load Google Identity Services script and render button
  useEffect(() => {
    if (!googleClientId || !buttonRef.current) return;

    let isMounted = true;

    const handleCredentialResponse = async (response: any) => {
      if (!response.credential) return;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ credential: response.credential }),
          credentials: 'include',
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Google sign-in failed');
        }

        await fetchUser();

        const searchParams = new URLSearchParams(window.location.search);
        const redirect = redirectUrl || searchParams.get('redirect');

        if (data.user?.role === 'superadmin') {
          navigate(redirect && redirect.startsWith('/admin') ? redirect : '/admin/dashboard');
        } else if (redirect && redirect.startsWith('/')) {
          navigate(redirect);
        } else {
          navigate('/');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Google authentication failed');
          setLoading(false);
        }
      }
    };

    const initializeGsi = () => {
      if (!window.google?.accounts?.id || !buttonRef.current) return;

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        shape: 'pill',
        theme: 'filled_black',
        text,
        size: 'large',
        logo_alignment: 'left',
        width: 320,
      });
    };

    if (window.google?.accounts?.id) {
      initializeGsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGsi;
      document.head.appendChild(script);
    }

    return () => {
      isMounted = false;
    };
  }, [googleClientId, text, redirectUrl, fetchUser, navigate]);

  return (
    <div className="w-full flex flex-col items-center">
      {error && (
        <div className="w-full bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-xl mb-3 text-xs text-center font-medium">
          {error}
        </div>
      )}

      {loading && (
        <div className="py-2 text-xs text-cyan-400 font-semibold flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span>Authenticating with Google...</span>
        </div>
      )}

      {googleClientId ? (
        <div ref={buttonRef} className="w-full flex justify-center min-h-[44px]" />
      ) : (
        <button
          type="button"
          onClick={() => setInfoModal(true)}
          className="w-full bg-neutral-900/90 hover:bg-neutral-800 text-white border border-white/15 rounded-xl py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-98 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>
      )}

      {/* Info modal for setup instructions when Client ID is not yet provided */}
      {infoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b101e] border border-white/20 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-3 text-left">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🔐</span> Google Sign-In Setup
              </h3>
              <button
                type="button"
                onClick={() => setInfoModal(false)}
                className="text-neutral-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Google OAuth integration is 100% built-in! To activate it on Render, add your Google Client ID:
            </p>
            <ol className="text-[11px] text-neutral-400 space-y-1.5 list-decimal list-inside bg-black/40 p-3 rounded-xl border border-white/10 font-mono">
              <li>Create credentials in Google Cloud Console</li>
              <li>Add your domain to Authorized Origins</li>
              <li>Set <span className="text-cyan-400">GOOGLE_CLIENT_ID</span> in Render Env</li>
            </ol>
            <button
              type="button"
              onClick={() => setInfoModal(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-2 text-xs font-semibold"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
