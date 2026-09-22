import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Lock, Search, Crown, ShieldCheck, UserCog, ArrowUpCircle, ArrowDownCircle, Trash2,
  ShoppingBag, Award, Clock, Banknote, Ticket, Mail, Phone, Calendar, Package,
  Gift, BadgeCheck, CircleDashed, ArrowUpRight, Eye,
} from 'lucide-react';
import { db } from '@/api/entities';
import { supabase } from '@/api/supabaseClient';
import { invokeFunction } from '@/lib/supabaseFunctions';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { fetchAllRows, toExcelDate, todayStamp } from '@/lib/excelExportHelpers';
import ExportExcelButton from '@/components/admin/ExportExcelButton';
import { orderRef, statusLabel } from '@/lib/orderStatus';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

// Literal bilingual placeholder (shown as-is regardless of the active
// language) for a profile field the customer never filled in.
const NOT_PROVIDED = 'غير مضاف / Not provided';

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

const ACTIVITY_LABEL_KEY = {
  order: 'users.activity.order',
  return: 'users.activity.return',
  loyalty: 'users.activity.loyalty',
  wallet: 'users.activity.wallet',
  reward: 'users.activity.reward',
};

function activityLabel(r, t, ar) {
  if (!r || !r.last_activity_at) return t('users.noActivity');
  const key = ACTIVITY_LABEL_KEY[r.last_activity_type];
  const kind = key ? t(key) : '';
  const when = new Date(r.last_activity_at).toLocaleString(ar ? 'ar-u-nu-latn' : 'en', {
    dateStyle: 'medium', timeStyle: 'short',
  });
  return `${kind} · ${when}`;
}

// Compact per-user quick report: orders count, net purchases (excludes
// cancelled orders and completed return refunds — see admin_user_reports()),
// available points/spins, last tracked activity — shown inline (list +
// delete confirmation + drawer) so an admin never has to open a separate
// page to see it before acting.
function UserReport({ report, t, formatPrice, ar }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1"><ShoppingBag className="w-3.5 h-3.5" /> {report?.total_orders ?? 0} {t('users.ordersCount')}</span>
      <span className="inline-flex items-center gap-1"><Banknote className="w-3.5 h-3.5" /> {formatPrice(report?.net_spent ?? 0)}</span>
      <span className="inline-flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {report?.points_balance ?? 0} {t('users.points')}</span>
      <span className="inline-flex items-center gap-1"><Ticket className="w-3.5 h-3.5" /> {report?.available_spins ?? 0} {t('users.spins')}</span>
      <span className="inline-flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {activityLabel(report, t, ar)}</span>
    </div>
  );
}

// "View Details" drawer: profile fields come from the row object already in
// memory (no re-fetch), orders count / net purchases / points / spins /
// latest activity come from the same bulk admin_user_reports() row the list
// already fetched — the only network call this drawer makes is the single
// on-demand admin_user_detail() RPC (cached per user id by the caller), for
// the handful of fields nothing else already has: email-confirmation
// status, pending points/spins, and the last order.
function UserDetailDrawer({ u, detail, loading, report, role, onClose, t, ar, lang, formatPrice }) {
  const open = !!u;
  const avgOrder = report?.total_orders ? (report.net_spent ?? 0) / report.total_orders : 0;
  const lastOrder = detail?.last_order;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side={ar ? 'right' : 'left'} className="w-[92vw] max-w-md p-0 overflow-y-auto" dir={ar ? 'rtl' : 'ltr'}>
        {u && (
          <div className="p-6">
            <SheetTitle className="sr-only">{t('users.viewDetails')}</SheetTitle>

            {/* Profile */}
            <div className="flex items-center gap-4">
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover shrink-0" />
              ) : (
                <div className="grid place-items-center w-16 h-16 rounded-full bg-cosmic/15 text-cosmic font-heading font-bold text-xl shrink-0">
                  {(u.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-heading font-extrabold text-lg">{u.full_name || NOT_PROVIDED}</p>
                <p className="text-sm text-muted-foreground truncate flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" /> {u.email}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" /> {u.phone || NOT_PROVIDED}</p>
              </div>
            </div>

            {/* Role, status, joined */}
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <RoleBadge role={role} t={t} />
              {detail?.account_confirmed_at ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-heading font-bold text-xs">
                  <BadgeCheck className="w-3.5 h-3.5" /> {t('users.verified')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mist text-muted-foreground font-heading font-bold text-xs">
                  <CircleDashed className="w-3.5 h-3.5" /> {t('users.unverified')}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mist text-muted-foreground font-heading font-bold text-xs">
                <Calendar className="w-3.5 h-3.5" /> {u.created_at ? new Date(u.created_at).toLocaleDateString(ar ? 'ar-u-nu-latn' : 'en') : '—'}
              </span>
            </div>

            {loading ? (
              <div className="mt-10 grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-cosmic" /></div>
            ) : (
              <>
                {/* Orders / purchases */}
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-mist p-3 text-center">
                    <p className="font-heading font-extrabold text-lg">{report?.total_orders ?? 0}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t('users.ordersCount')}</p>
                  </div>
                  <div className="rounded-2xl bg-mist p-3 text-center">
                    <p className="font-heading font-extrabold text-lg" dir="ltr">{formatPrice(report?.net_spent ?? 0)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t('users.netPurchases')}</p>
                  </div>
                  <div className="rounded-2xl bg-mist p-3 text-center">
                    <p className="font-heading font-extrabold text-lg" dir="ltr">{formatPrice(avgOrder)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t('users.avgOrderValue')}</p>
                  </div>
                </div>

                {/* Last order */}
                <div className="mt-4 rounded-2xl bg-card border border-border/60 p-4">
                  <p className="text-xs font-heading font-bold text-muted-foreground flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> {t('users.lastOrder')}</p>
                  {lastOrder ? (
                    <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="font-heading font-bold" dir="ltr">{orderRef(lastOrder)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {statusLabel(lastOrder.status, lang)} · {new Date(lastOrder.created_date).toLocaleDateString(ar ? 'ar-u-nu-latn' : 'en')}
                        </p>
                      </div>
                      <p className="font-heading font-extrabold" dir="ltr">{formatPrice(lastOrder.total || 0)}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">{t('users.noOrders')}</p>
                  )}
                </div>

                {/* Points / spins */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-card border border-border/60 p-3">
                    <p className="text-xs font-heading font-bold text-muted-foreground flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> {t('users.points')}</p>
                    <p className="mt-1 font-heading font-extrabold">{report?.points_balance ?? 0} <span className="text-xs font-normal text-muted-foreground">{t('users.available')}</span></p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Gift className="w-3 h-3" /> {detail?.pending_points ?? 0} {t('users.pendingLabel')}</p>
                  </div>
                  <div className="rounded-2xl bg-card border border-border/60 p-3">
                    <p className="text-xs font-heading font-bold text-muted-foreground flex items-center gap-1.5"><Ticket className="w-3.5 h-3.5" /> {t('users.spins')}</p>
                    <p className="mt-1 font-heading font-extrabold">{detail?.available_spins ?? report?.available_spins ?? 0} <span className="text-xs font-normal text-muted-foreground">{t('users.available')}</span></p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Gift className="w-3 h-3" /> {detail?.pending_spins ?? 0} {t('users.pendingLabel')}</p>
                  </div>
                </div>

                {/* Latest activity */}
                <div className="mt-4 rounded-2xl bg-mist p-3 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{activityLabel(report, t, ar)}</span>
                </div>

                {/* Links -- keyed by the customer's stable id, not email:
                    an order's customer_email can be blank, so matching by
                    id on the target page is the only reliable link. */}
                <div className="mt-6">
                  <p className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wide">{t('users.relatedRecords')}</p>
                  <div className="mt-2 grid gap-2">
                    <Link
                      to={`/orders-admin?u=${u.id}&name=${encodeURIComponent(u.full_name || u.email)}`}
                      className="flex items-center justify-between h-11 px-4 rounded-2xl bg-mist font-heading font-bold text-sm hover:bg-mist/70"
                    >
                      <span className="inline-flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> {t('users.viewOrders')}</span>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                    <Link
                      to={`/admin/return-requests?u=${u.id}&name=${encodeURIComponent(u.full_name || u.email)}`}
                      className="flex items-center justify-between h-11 px-4 rounded-2xl bg-mist font-heading font-bold text-sm hover:bg-mist/70"
                    >
                      <span className="inline-flex items-center gap-2"><Package className="w-4 h-4" /> {t('users.viewReturns')}</span>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                    <Link
                      to={`/loyalty-admin?u=${u.id}&name=${encodeURIComponent(u.full_name || u.email)}`}
                      className="flex items-center justify-between h-11 px-4 rounded-2xl bg-mist font-heading font-bold text-sm hover:bg-mist/70"
                    >
                      <span className="inline-flex items-center gap-2"><Gift className="w-4 h-4" /> {t('users.viewRewards')}</span>
                      <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function UserManagement() {
  const { user, navigateToLogin, checkUserAuth } = useAuth();
  const { t, lang, formatPrice } = useLanguage();
  const ar = lang === 'ar';
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState({}); // user_id -> { total_orders, total_spent, points_balance, wallet_balance, last_activity_at, last_activity_type }
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(null); // { u, action: 'promote' | 'demote' | 'delete' }
  const [busyId, setBusyId] = useState(null);
  // True when the list came back empty because the Supabase session went
  // stale (RLS then silently returns zero rows, no error) rather than the
  // table genuinely having no other users — an admin's own row always
  // exists, so an empty result is never legitimate while `isOwnerAdmin` is
  // true. Without this, a dropped session looks identical to "no users".
  const [sessionIssue, setSessionIssue] = useState(false);
  // Drawer: `detailUser` is the row being shown (from the already-loaded
  // list — no re-fetch for name/email/phone/role). `detailCache` keeps the
  // one-time admin_user_detail() result per user id, so reopening the same
  // user's drawer never issues a second request.
  const [detailUser, setDetailUser] = useState(null);
  const [detailCache, setDetailCache] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);

  const isOwnerAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    setSessionIssue(false);
    try {
      const [list, res] = await Promise.all([
        db.Profile.list('-created_at', 200),
        supabase.rpc('admin_user_reports'),
      ]);
      // Both calls hit the DB in the same instant. If the list came back
      // RLS-empty AND the sibling RPC (grant-restricted to admins) was
      // outright rejected, that rejection is proof the session was already
      // stale at that exact moment — a race-free signal, unlike checking
      // getSession() afterwards, which can see the session having already
      // silently recovered by then and falsely call it "no other users".
      if (list.length === 0 && res.error) {
        setUsers([]);
        setSessionIssue(true);
        return;
      }
      setUsers(list);
      setReports(Object.fromEntries((res.data || []).map((r) => [r.user_id, r])));
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

  const openDetail = async (u) => {
    setDetailUser(u);
    if (detailCache[u.id]) return;
    setDetailLoading(true);
    try {
      const { data, error } = await supabase.rpc('admin_user_detail', { p_user_id: u.id });
      if (!error && data?.success) {
        setDetailCache((c) => ({ ...c, [u.id]: data }));
      }
    } finally {
      setDetailLoading(false);
    }
  };

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

  // ── Excel export ──────────────────────────────────────────────────────
  const roleLabel = (u) => {
    const r = roleOf(u, ownerId);
    return r === OWNER ? t('users.owner') : r === ADMIN ? t('users.admin') : t('users.user');
  };
  const userColumns = [
    { header: ar ? 'الاسم الكامل' : 'Full Name', key: 'name', width: 22, wrap: true },
    { header: ar ? 'البريد الإلكتروني' : 'Email', key: 'email', width: 26 },
    { header: ar ? 'الهاتف' : 'Phone', key: 'phone', width: 16 },
    { header: ar ? 'الدور' : 'Role', key: 'role', width: 12 },
    { header: ar ? 'تاريخ الانضمام' : 'Joined', key: 'joined', width: 14, type: 'date' },
  ];
  const buildUserRow = (u) => ({
    name: u.full_name || '',
    email: u.email || '',
    phone: u.phone || '',
    role: roleLabel(u),
    joined: toExcelDate(u.created_at),
  });
  const getUserSheets = async (scope) => {
    const rows = scope === 'all' ? await fetchAllRows(db.Profile, '-created_at') : filtered;
    return {
      sheets: [{ name: ar ? 'المستخدمون' : 'Users', columns: userColumns, rows: rows.map(buildUserRow) }],
      fileName: `users_${todayStamp()}.xlsx`,
    };
  };

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
      if (action === 'delete') {
        const { data, error } = await supabase.rpc('admin_delete_user_account', { p_user_id: u.id });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.message || 'Error');
        toast({ title: t('users.deleted') });
        await load();
        return;
      }
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
    const viewButton = (
      <button
        onClick={() => openDetail(u)}
        className="squish h-9 px-4 rounded-full bg-mist font-heading font-bold text-sm inline-flex items-center gap-2"
      >
        <Eye className="w-4 h-4" /> {t('users.viewDetails')}
      </button>
    );
    if (!canActOn(u))
      return (
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {viewButton}
          <span className="text-xs text-muted-foreground">
            {r === OWNER ? t('users.cantDemoteOwner') : t('users.selfNote')}
          </span>
        </div>
      );
    const promote = r === USER;
    return (
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {viewButton}
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
        {/* Delete is only ever offered for a plain customer account — an
            admin/owner must be demoted first (server enforces this too). */}
        {r === USER && (
          <button
            onClick={() => setPending({ u, action: 'delete' })}
            className="squish h-9 px-4 rounded-full bg-destructive/10 text-destructive font-heading font-bold text-sm inline-flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> {t('users.delete')}
          </button>
        )}
      </div>
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

        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('users.search')}
              className="w-full h-11 ps-9 pe-3 rounded-2xl bg-mist border border-border text-sm"
            />
          </div>
          <ExportExcelButton getSheets={getUserSheets} scopes={['filtered', 'all']} className="shrink-0" />
        </div>

        {loading ? (
          <div className="mt-12 grid place-items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-cosmic" />
          </div>
        ) : filtered.length === 0 && sessionIssue ? (
          <div className="mt-10 rounded-3xl bg-mist/60 p-16 text-center">
            <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <p className="mt-6 font-heading font-bold text-2xl">{t('users.sessionExpiredTitle')}</p>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">{t('users.sessionExpiredDesc')}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                onClick={() => { checkUserAuth(); load(); }}
                className="squish h-11 px-6 rounded-full bg-mist font-heading font-bold text-sm"
              >
                {t('users.retry')}
              </button>
              <button
                onClick={navigateToLogin}
                className="squish h-11 px-6 rounded-full bg-cosmic text-white font-heading font-bold text-sm"
              >
                {t('users.loginAgain')}
              </button>
            </div>
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
                            {/* Not `truncate`: the bilingual "Not provided"
                                placeholder mixes scripts, and RTL bidi
                                truncation can cut it from the wrong end. */}
                            <p className="font-heading font-bold">
                              {u.full_name || NOT_PROVIDED}{' '}
                              {u.id === user?.id && (
                                <span className="text-muted-foreground font-normal">· {t('users.you')}</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            <p className="text-xs text-muted-foreground">{u.phone || NOT_PROVIDED}</p>
                            <UserReport report={reports[u.id]} t={t} formatPrice={formatPrice} ar={ar} />
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
                      <p className="font-heading font-bold">
                        {u.full_name || NOT_PROVIDED}{' '}
                        {u.id === user?.id && (
                          <span className="text-muted-foreground font-normal">· {t('users.you')}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.phone || NOT_PROVIDED}</p>
                    </div>
                    <RoleBadge role={u._role} t={t} />
                  </div>
                  <UserReport report={reports[u.id]} t={t} formatPrice={formatPrice} ar={ar} />
                  <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
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
            <AlertDialogTitle>
              {pending?.action === 'delete' ? t('users.deleteConfirmTitle') : t('users.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === 'promote' ? t('users.promoteConfirm')
                : pending?.action === 'demote' ? t('users.demoteConfirm')
                : t('users.deleteConfirmDesc')}
            </AlertDialogDescription>
            {pending && (
              <div className="mt-2 rounded-2xl bg-mist p-3 text-sm">
                <p className="font-heading font-bold">{pending.u.full_name || pending.u.email}</p>
                <p className="text-muted-foreground">{pending.u.email}</p>
                {pending.action === 'delete' && <UserReport report={reports[pending.u.id]} t={t} formatPrice={formatPrice} ar={ar} />}
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busyId}>{t('users.cancel')}</AlertDialogCancel>
            <Button
              onClick={confirmChange}
              disabled={!!busyId}
              className={
                pending?.action === 'promote'
                  ? 'bg-cosmic text-white hover:bg-cosmic'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive'
              }
            >
              {busyId ? <Loader2 className="w-4 h-4 animate-spin" /> : pending?.action === 'delete' ? t('users.delete') : t('users.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserDetailDrawer
        u={detailUser}
        detail={detailUser ? detailCache[detailUser.id] : null}
        loading={detailLoading && !(detailUser && detailCache[detailUser.id])}
        report={detailUser ? reports[detailUser.id] : null}
        role={detailUser?._role}
        onClose={() => setDetailUser(null)}
        t={t} ar={ar} lang={lang} formatPrice={formatPrice}
      />
    </div>
  );
}