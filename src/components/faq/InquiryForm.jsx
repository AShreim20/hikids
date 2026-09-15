import React, { useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { db } from '@/api/entities';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { setChatOpen } from '@/lib/chatOpenStore';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 200;
const MAX_QUESTION = 2000;

// FAQ page's "Have another question?" CTA — a real customer question form
// (see supabase/migrations/0019_customer_inquiries.sql) instead of the old
// dead-end "browse the shop" button. Public INSERT only, same shape as
// Newsletter.jsx's signup — a guest can submit, and nobody but an admin can
// ever read the list back (see CustomerInquiries.jsx).
export default function InquiryForm() {
  const { lang } = useLanguage();
  const ar = lang === 'ar';
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auth resolves asynchronously, so `user` can arrive a tick after this
  // component first renders. Only fill a field that's still empty — never
  // overwrite something the customer already edited themselves.
  useEffect(() => {
    if (!user) return;
    setName((v) => v || user.full_name || '');
    setPhone((v) => v || user.phone || '');
    setEmail((v) => v || user.email || '');
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedQuestion = question.trim();
    const phoneDigits = trimmedPhone.replace(/\D/g, '');

    if (!trimmedName) {
      toast({ title: ar ? 'الرجاء إدخال الاسم' : 'Please enter your name', variant: 'destructive' });
      return;
    }
    if (!trimmedPhone && !trimmedEmail) {
      toast({ title: ar ? 'الرجاء إدخال رقم هاتف أو بريد إلكتروني' : 'Please enter a phone number or email', variant: 'destructive' });
      return;
    }
    if (trimmedPhone && phoneDigits.length < 7) {
      toast({ title: ar ? 'رقم الهاتف غير صالح' : 'Please enter a valid phone number', variant: 'destructive' });
      return;
    }
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      toast({ title: ar ? 'البريد الإلكتروني غير صالح' : 'Please enter a valid email', variant: 'destructive' });
      return;
    }
    if (!trimmedQuestion) {
      toast({ title: ar ? 'الرجاء كتابة سؤالك' : 'Please write your question', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      await db.CustomerInquiry.create(
        {
          id: crypto.randomUUID(),
          customer_id: user?.id || null,
          customer_name: trimmedName.slice(0, MAX_NAME),
          customer_phone: trimmedPhone || null,
          customer_email: trimmedEmail || null,
          question: trimmedQuestion.slice(0, MAX_QUESTION),
        },
        { returning: false }
      );
      setQuestion('');
      toast({
        title: ar
          ? 'تم إرسال سؤالك بنجاح، سنتواصل معك قريبًا 💜'
          : "Your question was sent successfully. We'll get back to you soon 💜",
      });
    } catch (err) {
      // The DB's own spam guard (customer_inquiry_rate_ok) rejects the
      // insert as an RLS violation once the same phone/email has sent a few
      // inquiries in a short window — give that a friendlier message than
      // the generic fallback.
      const rateLimited = err?.code === '42501';
      toast({
        title: rateLimited
          ? (ar ? 'لقد أرسلت عدة أسئلة مؤخرًا، الرجاء المحاولة لاحقًا' : "You've sent a few questions recently — please try again later")
          : (ar ? 'تعذّر إرسال سؤالك، حاول مرة أخرى' : 'Could not send your question, please try again'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const input = 'h-12 w-full px-4 rounded-2xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic text-sm';

  return (
    <form onSubmit={submit} className="mt-6 space-y-3 text-start">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="inq-name" className="sr-only">{ar ? 'الاسم' : 'Name'}</label>
          <input
            id="inq-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME}
            placeholder={ar ? 'الاسم' : 'Name'}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="inq-phone" className="sr-only">{ar ? 'رقم الهاتف' : 'Phone Number'}</label>
          <input
            id="inq-phone"
            type="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={ar ? 'رقم الهاتف' : 'Phone Number'}
            className={input}
          />
        </div>
      </div>

      <div>
        <label htmlFor="inq-email" className="sr-only">{ar ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}</label>
        <input
          id="inq-email"
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={ar ? 'البريد الإلكتروني (اختياري)' : 'Email (optional)'}
          className={input}
        />
      </div>

      <div>
        <label htmlFor="inq-question" className="sr-only">{ar ? 'سؤالك' : 'Your Question'}</label>
        <textarea
          id="inq-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION}
          rows={3}
          placeholder={ar ? 'اكتب سؤالك هنا...' : 'Write your question here...'}
          className="w-full px-4 py-3 rounded-2xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic text-sm resize-none"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="squish inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold disabled:opacity-70"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {ar ? 'إرسال السؤال' : 'Send Question'}
        </button>
        {/* Secondary option only — the human inquiry form above stays the
            primary way to ask, per the task's own instruction not to replace
            it with the assistant. Opens the existing chat widget (already
            mounted globally in App.jsx) via its existing open/close store. */}
        <button
          type="button"
          onClick={() => setChatOpen(true)}
          className="text-sm font-heading font-bold text-cosmic hover:underline"
        >
          {ar ? 'أو اسأل مساعد HiKids' : 'Or ask HiKids Assistant'}
        </button>
      </div>
    </form>
  );
}
