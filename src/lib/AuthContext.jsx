import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { queryClientInstance } from '@/lib/query-client';
import { clearUserScopedQueries } from '@/lib/queryKeys';

const AuthContext = createContext();

// Every field that actually matters to the rest of the app for deciding
// "is this the same user, unchanged" — used to avoid handing out a new
// `user` object reference (see setStableUser below) when nothing in it
// actually changed.
const USER_FIELDS = ['id', 'email', 'phone', 'full_name', 'role', 'permissions', 'avatar_url'];
function sameUser(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return USER_FIELDS.every((k) => {
    if (k === 'permissions') return JSON.stringify(a[k] || []) === JSON.stringify(b[k] || []);
    return a[k] === b[k];
  });
}

async function loadUser(session) {
  if (!session?.user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  return {
    id: session.user.id,
    email: session.user.email,
    phone: profile?.phone ?? session.user.user_metadata?.phone ?? null,
    full_name: profile?.full_name ?? null,
    avatar_url: profile?.avatar_url ?? null,
    role: profile?.role ?? 'user',
    permissions: profile?.permissions ?? [],
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Supabase fires onAuthStateChange (SIGNED_IN/TOKEN_REFRESHED) on its own
  // periodic token refresh and again whenever the tab regains focus/
  // visibility — by design, to keep the session valid, and this must keep
  // happening. The bug was never that refresh firing; it's that every fire
  // used to hand out a brand-new `user` object (loadUser() always builds a
  // fresh literal) even when nothing about the user actually changed. Any
  // component effect depending on `user` — e.g. Product Edit's old fetch
  // effect — saw that as a real change and re-ran, silently refetching and
  // overwriting whatever was being edited. Comparing field-by-field here and
  // keeping the *same* object when nothing changed stops that cascade for
  // every consumer at once, without touching Supabase's refresh behavior.
  const setStableUser = (nextUser) => {
    setUser((prev) => (sameUser(prev, nextUser) ? prev : nextUser));
  };

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const nextUser = await loadUser(session);
      setStableUser(nextUser);
      setIsAuthenticated(!!nextUser);
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'unknown', message: error.message || 'Failed to check auth' });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session).then((nextUser) => {
        setStableUser(nextUser);
        setIsAuthenticated(!!nextUser);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      });
    });
    return () => subscription.unsubscribe();
  }, [checkUserAuth]);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    // Any cached loyalty/wallet/rewards/challenges/favorites/notifications/
    // account query must not still answer from cache for whoever signs in
    // next on this device (cart/wishlist are cleared the same way, on their
    // own SIGNED_OUT listener — see CartContext/WishlistContext).
    clearUserScopedQueries(queryClientInstance);
    if (shouldRedirect) {
      window.location.href = '/login';
    }
  };

  const navigateToLogin = () => {
    const returnTo = window.location.pathname + window.location.search;
    window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
