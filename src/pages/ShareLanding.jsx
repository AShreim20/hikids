import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Check, AlertCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { unwrap } from '@/lib/invoke';
import { useLanguage } from '@/context/LanguageContext';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// Landing page for a "share" challenge link. A distinct visitor opening this
// page is the verifiable share action (recorded server-side by recordShareView).
export default function ShareLanding() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('c');
    const e = params.get('e');
    if (!c || !e) { setState({ loading: false, error: true }); return; }
    base44.functions.invoke('recordShareView', { challenge_id: c, sharer_email: e })
      .then((raw) => {
        const res = unwrap(raw);
        setState({ loading: false, counted: !!res.counted, self: !!res.self, duplicate: !!res.duplicate, need: res.need, progress: res.progress });
      })
      .catch(() => setState({ loading: false, error: true }));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-md mx-auto px-5 py-24 text-center">
        {state.loading ? (
          <Loader2 className="w-8 h-8 animate-spin text-cosmic mx-auto" />
        ) : state.error ? (
          <>
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="mt-6 font-heading font-extrabold text-2xl">{ar ? 'رابط غير صالح' : 'Invalid link'}</h1>
          </>
        ) : state.self ? (
          <>
            <Sparkles className="w-12 h-12 text-cosmic mx-auto" />
            <h1 className="mt-6 font-heading font-extrabold text-2xl">{ar ? 'هذا رابطك أنت!' : 'This is your own link!'}</h1>
            <p className="mt-3 text-muted-foreground">{ar ? 'لا يمكنك احتساب مشاركتك لنفسك' : 'You can\'t count yourself as a share recipient'}</p>
          </>
        ) : state.duplicate ? (
          <>
            <Check className="w-12 h-12 text-cosmic mx-auto" />
            <h1 className="mt-6 font-heading font-extrabold text-2xl">{ar ? 'تم التسجيل مسبقًا' : 'Already counted'}</h1>
            <p className="mt-3 text-muted-foreground">{ar ? 'تم احتساب هذه المشاركة من قبل' : 'This share was already recorded'}</p>
          </>
        ) : state.counted ? (
          <>
            <div className="mx-auto grid place-items-center w-20 h-20 rounded-full bg-cosmic/10 text-cosmic"><Check className="w-10 h-10" /></div>
            <h1 className="mt-6 font-heading font-extrabold text-3xl">{ar ? 'شكرًا لمشاركتك! 🎉' : 'Thanks for sharing! 🎉'}</h1>
            <p className="mt-3 text-muted-foreground">{ar ? 'تم احتساب مشاركتك بنجاح' : 'Your share was recorded'}</p>
          </>
        ) : null}
        <Link to="/" className="mt-8 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold">{ar ? 'تصفّح هاي كيدز' : 'Explore HiKids'}</Link>
      </div>
      <Footer />
    </div>
  );
}