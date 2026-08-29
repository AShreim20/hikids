import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, ShieldCheck, Send, Save } from 'lucide-react';
import { db } from '@/api/entities';
import { invokeFunction } from '@/lib/supabaseFunctions';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { usePermissions, permsOf } from '@/lib/permissions';
import PermissionsMatrix from '@/components/staff/PermissionsMatrix';

export default function StaffManagement() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const { isOwner } = usePermissions();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, l] = await Promise.all([
        db.Profile.list('-created_at', 100),
        db.AuditLog.list('-created_date', 50).catch(() => []),
      ]);
      setUsers(u);
      setLogs(l);
      const d = {};
      u.forEach((x) => {
        d[x.id] = { role: x.role, permissions: permsOf(x) };
      });
      setDraft(d);
    } catch {
      setUsers([]);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) load();
    else setLoading(false);
  }, [isOwner]);

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-3xl">{t('staff.denied')}</h1>
          <p className="mt-3 text-muted-foreground">{t('staff.deniedDesc')}</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            {t('pd.back')}
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const invite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      await invokeFunction('inviteUser', { email });
      toast({ title: t('staff.inviteSent') });
      setInviteEmail('');
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const setField = (id, key, val) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: val } }));

  const saveUser = async (u) => {
    const d = draft[u.id];
    if (!d) return;
    setSavingId(u.id);
    try {
      const changes = {};
      if (d.role !== u.role) changes.role = d.role;
      const orig = permsOf(u);
      const same =
        orig.length === d.permissions.length && orig.every((p) => d.permissions.includes(p));
      if (!same) changes.permissions = d.permissions;
      if (Object.keys(changes).length === 0) {
        toast({ title: t('staff.noChanges') });
        return;
      }
      await db.Profile.update(u.id, changes);
      await invokeFunction('logAuditActivity', {
        action: 'staff.permissions_updated',
        target_type: 'user',
        target_id: u.id,
        details: `Updated ${u.email}: ${JSON.stringify(changes)}`,
      });
      toast({ title: t('staff.saved') });
      load();
    } catch (err) {
      toast({ title: err.message || 'Error', variant: 'destructive' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 md:pl-16">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {t('pd.back')}
        </Link>
        <div className="mt-6">
          <p className="text-sm uppercase tracking-widest text-muted-foreground font-medium">
            {t('staff.subtitle')}
          </p>
          <h1 className="mt-2 font-heading font-extrabold text-4xl md:text-5xl">{t('staff.title')}</h1>
        </div>

        {/* Invite */}
        <form onSubmit={invite} className="mt-8 rounded-3xl bg-mist/60 p-5 md:p-6 flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="block flex-1">
            <span className="text-sm font-medium text-foreground/80">{t('staff.inviteEmail')}</span>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@example.com"
              className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
            />
          </label>
          <button
            type="submit"
            disabled={inviting}
            className="squish h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {inviting ? t('staff.inviting') : t('staff.inviteBtn')}
          </button>
        </form>

        {/* Team list */}
        <h2 className="mt-12 font-heading font-extrabold text-2xl">{t('staff.team')}</h2>
        {loading ? (
          <div className="mt-6 grid place-items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cosmic" />
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {users.map((u) => {
              const d = draft[u.id] || { role: u.role, permissions: permsOf(u) };
              const self = u.id === user?.id;
              const dirty =
                d.role !== u.role ||
                permsOf(u).length !== d.permissions.length ||
                !permsOf(u).every((p) => d.permissions.includes(p));
              return (
                <div key={u.id} className="rounded-3xl bg-card border border-border/60 p-5 md:p-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid place-items-center w-11 h-11 rounded-full bg-cosmic/15 text-cosmic font-heading font-bold">
                        {(u.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-heading font-bold">
                          {u.email} {self && <span className="text-muted-foreground font-normal">· {t('staff.you')}</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {d.role === 'admin'
                            ? t('staff.owner')
                            : d.permissions.length > 0
                            ? t('staff.member')
                            : t('staff.customer')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={self}
                        onClick={() => setField(u.id, 'role', d.role === 'admin' ? 'user' : 'admin')}
                        className="h-9 px-4 rounded-full bg-mist text-sm font-heading font-bold disabled:opacity-50"
                      >
                        {d.role === 'admin' ? t('staff.makeMember') : t('staff.makeOwner')}
                      </button>
                    </div>
                  </div>

                  {d.role !== 'admin' && (
                    <div className="mt-5">
                      <p className="text-sm font-medium text-foreground/80">{t('staff.permissions')}</p>
                      {self ? (
                        <p className="mt-2 text-sm text-muted-foreground">{t('staff.selfNote')}</p>
                      ) : (
                        <div className="mt-3">
                          <PermissionsMatrix
                            value={d.permissions}
                            onChange={(perms) => setField(u.id, 'permissions', perms)}
                          />
                          {d.permissions.length === 0 && (
                            <p className="mt-3 text-xs text-muted-foreground">{t('staff.noPerms')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {dirty && !self && (
                    <div className="mt-5 flex justify-end">
                      <button
                        type="button"
                        onClick={() => saveUser(u)}
                        disabled={savingId === u.id}
                        className="squish h-11 px-6 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        {savingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {savingId === u.id ? t('staff.saving') : t('staff.save')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Activity log */}
        <h2 className="mt-16 font-heading font-extrabold text-2xl">{t('staff.audit')}</h2>
        <div className="mt-6 rounded-3xl bg-card border border-border/60 overflow-hidden">
          {logs.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">{t('staff.auditEmpty')}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {logs.map((l) => (
                <li key={l.id} className="p-4 md:p-5 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-cosmic shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-sm break-words">{l.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('staff.by')} {l.actor_email || l.actor_id} · {new Date(l.created_date).toLocaleString()}
                    </p>
                    {l.details && <p className="mt-1 text-sm text-muted-foreground break-words">{l.details}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}