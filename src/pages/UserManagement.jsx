import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Search, Crown, ShieldCheck, UserCog, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { db } from '@/api/entities';
import { invokeFunction } from '@/lib/supabaseFunctions';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

const OWNER = 'owner';
const ADMIN = 'admin';
const USER = 'user';

// Owner = the admin with the oldest account (the original app owner). Every
// other `admin` is a promoted Admin with identical access; `user` is a regular
// customer. Both Owner and Admin map to the platform role "admin", so both
// pass `isOwner()` / `can()` everywhere — promote grants full Owner access.
function roleOf(u, ownerId) {
  if (u.role === 'admin') return u.id === ownerId ? OWNER : ADMIN;
  return USER;
}

function RoleBadge({ role, t }) {
  if (role === OWNER)
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 text-accent font-heading font-bold text-xs">
        <Crown className="w-3.5 h-3.5" /> {t('users.owner')}
      </span>
    );
  if (role === ADMIN)
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cosmic/15 text-cosmic font-heading font-bold text-xs">
        <ShieldCheck className="w-3.5 h-3.5" /> {t('users.admin')}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mist text-muted-foreground font-heading font-bold text-xs">
      <UserCog className="w-3.5 h-3.5" /> {t('users.user')}
    </span>
  );
}

export default function UserManagement() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(null); // { u, action: 'promote' | 'demote' }
  const [busyId, setBusyId] = useState(null);

  const isOwnerAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      setUsers(await db.Profile.list('-created_at', 200));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwnerAdmin) load();
    else setLoading(false);
  }, [isOwnerAdmin]);

  const ownerId = useMemo(() => {
    const admins = users.filter((u) => u.role === 'admin');
    if (!admins.length) return null;
    return admins
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0].id;
  }, [users]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = users.map((u) => ({ ...u, _role: roleOf(u, ownerId) }));
    if (!term) return list;
    return list.filter((u) =>
      [u.email, u.full_name, u.phone].filter(Boolean).join(' ').toLowerCase().includes(term)
    );
  }, [users, q, ownerId]);

  const counts = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
    }),
    [users]
  );

  if (!isOwnerAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('users.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('users.deniedDesc')}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            {t('pd.back')}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const canActOn = (u) => {
    if (u.id === user?.id) return false; // never change your own role here
    return roleOf(u, ownerId) !== OWNER; // the Owner cannot be demoted
  };

  const confirmChange = async () => {
    if (!pending) return;
    const { u, action } = pending;
    setBusyId(u.id);
    try {
      const newRole = action === 'promote' ? 'admin' : 'user';
      // Updates the user's actual authorization role — promoted admins gain
      // full Owner-level access (isOwner/can) immediately on their next auth.
      await db.Profile.update(u.id, { role: newRole });
      await invokeFunction('logAuditActivity', {
        action: action === 'promote' ? 'user.promoted' : 'user.demoted',
        target_type: 'user',
        target_id: u.id,
        details: `${u.email} → ${newRole}`,
      });
      toast({ title: action === 'promote' ? t('users.promoted') : t('users.demoted') });
      await load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setBusyId(null);
      setPending(null);
    }
  };

  const ActionButton = ({ u }) => {
    const r = u._role;
    if (!canActOn(u))
      return (
        <span className="text-xs text-muted-foreground">
          {r === OWNER ? t('users.cantDemoteOwner') : t('users.selfNote')}
        </span>
      );
    const promote = r === USER;
    return (
      <button
        onClick={() => setPending({ u, action: promote ? 'promote' : 'demote' })}
        className="squish h-9 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-2"
      >
        {promote ? (
          <>
            <ArrowUpCircle className="w-4 h-4" /> {t('users.promote')}
          </>
        ) : (
          <>
            <ArrowDownCircle className="w-4 h-4" /> {t('users.demote')}
          </>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('admin.title')}
        </Link>
        <div className="mt-6 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">{t('users.subtitle')}</p>
            <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('users.title')}</h1>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="px-3 py-1.5 rounded-full bg-mist font-heading font-bold">{counts.total} {t('users.total')}</span>
            <span className="px-3 py-1.5 rounded-full bg-cosmic/10 text-cosmic font-heading font-bold">{counts.admins} {t('users.admin')}</span>
          </div>
        </div>

        <div className="relative mt-8 max-w-md">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('users.search')}
            className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm"
          />
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cosmic" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <p className="font-heading font-bold text-2xl">{t('users.empty')}</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="mt-8 hidden md:block rounded-3xl bg-card border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-mist/60 text-muted-foreground">
                  <tr>
                    <th className="text-start font-heading font-bold px-5 py-3">User</th>
                    <th className="text-start font-heading font-bold px-5 py-3">{t('users.role')}</th>
                    <th className="text-start font-heading font-bold px-5 py-3">{t('users.joined')}</th>
                    <th className="text-end font-heading font-bold px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-mist/30">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid place-items-center w-10 h-10 rounded-full bg-cosmic/15 text-cosmic font-heading font-bold">
                            {(u.email || '?').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-heading font-bold truncate">
                              {u.full_name || u.email}{' '}
                              {u.id === user?.id && (
                                <span className="text-muted-foreground font-normal">· {t('users.you')}</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><RoleBadge role={u._role} t={t} /></td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3 text-end">
                        <ActionButton u={u} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="mt-8 md:hidden space-y-3">
              {filtered.map((u) => (
                <div key={u.id} className="rounded-3xl bg-card border border-border/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid place-items-center w-10 h-10 rounded-full bg-cosmic/15 text-cosmic font-heading font-bold">
                      {(u.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold truncate">
                        {u.full_name || u.email}{' '}
                        {u.id === user?.id && (
                          <span className="text-muted-foreground font-normal">· {t('users.you')}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <RoleBadge role={u._role} t={t} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {u.created_date ? new Date(u.created_date).toLocaleDateString() : '—'}
                    </span>
                    <ActionButton u={u} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      <Footer />

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !busyId && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === 'promote' ? t('users.promoteConfirm') : t('users.demoteConfirm')}
            </AlertDialogDescription>
            {pending && (
              <div className="mt-2 rounded-2xl bg-mist p-3 text-sm">
                <p className="font-heading font-bold">{pending.u.full_name || pending.u.email}</p>
                <p className="text-muted-foreground">{pending.u.email}</p>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>{t('users.cancel')}</AlertDialogCancel>
            <Button
              onClick={confirmChange}
              disabled={!!busyId}
              className={
                pending?.action === 'demote'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive'
                  : 'bg-cosmic text-white hover:bg-cosmic'
              }
            >
              {busyId ? <Loader2 className="w-4 h-4 animate-spin" /> : t('users.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}