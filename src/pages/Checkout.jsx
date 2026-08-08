import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Banknote, ShieldCheck, Check, Lock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';

export default function Checkout() {
  const { items, total, clear } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    address: '',
    phone: '',
  });
  const [payment, setPayment] = useState('card');
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '' });
  const [placing, setPlacing] = useState(false);
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const placeOrder = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;
    setPlacing(true);
    try {
      const order = await base44.entities.Order.create({
        items: items.map((i) => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
        total,
        customer_name: form.name,
        customer_email: form.email,
        address: form.address,
        phone: form.phone,
        payment_method: payment,
        status: payment === 'card' ? 'paid' : 'pending',
      });
      setOrderId(order.id);
      clear();
      setDone(true);
      base44.functions.invoke('onOrderPlaced', { orderId: order.id }).catch(() => {});
      toast({ title: payment === 'card' ? 'Payment received' : 'Order reserved', description: 'We’ll be in touch shortly.' });
    } catch (err) {
      toast({ title: 'Something went wrong', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setPlacing(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-24 text-center">
          <div className="mx-auto grid place-items-center w-20 h-20 rounded-full bg-accent/20 text-accent">
            <Check className="w-10 h-10" />
          </div>
          <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">
            {payment === 'card' ? 'Payment received!' : 'Order reserved!'}
          </h1>
          <p className="mt-4 text-muted-foreground text-lg">
            {payment === 'card'
              ? 'Thank you. Your toys are being wrapped like a gift.'
              : 'Thank you. Pay in cash when your order arrives — simple and trusted.'}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">Order reference: {orderId?.slice(-8).toUpperCase()}</p>
          <Link to="/" className="mt-8 inline-flex items-center gap-2 h-14 px-8 rounded-full bg-cosmic text-white font-heading font-bold squish">
            Back to the collection
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-2xl mx-auto px-5 py-32 text-center">
          <h1 className="font-heading font-extrabold text-3xl">Your cart is empty</h1>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-cosmic font-heading font-bold">
            <ArrowLeft className="w-4 h-4" /> Go shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        <Link to="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to cart
        </Link>
        <h1 className="mt-6 font-heading font-extrabold text-4xl md:text-5xl">Checkout</h1>

        <form onSubmit={placeOrder} className="mt-10 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            {/* Contact & delivery */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <h2 className="font-heading font-extrabold text-2xl">1. Delivery details</h2>
              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                <Field label="Full name" required value={form.name} onChange={set('name')} placeholder="Jane Parent" />
                <Field label="Email" type="email" required value={form.email} onChange={set('email')} placeholder="jane@email.com" />
                <Field label="Phone" required value={form.phone} onChange={set('phone')} placeholder="+1 555 000 0000" />
                <Field label="Delivery address" required value={form.address} onChange={set('address')} placeholder="123 Wonder Street" />
              </div>
            </div>

            {/* Payment */}
            <div className="rounded-3xl bg-card border border-border/60 p-6 md:p-8">
              <h2 className="font-heading font-extrabold text-2xl">2. Payment method</h2>
              <p className="mt-1 text-sm text-muted-foreground">Choose how you’d like to pay.</p>

              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setPayment('card')}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    payment === 'card' ? 'border-cosmic bg-cosmic/5' : 'border-border hover:border-cosmic/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="grid place-items-center w-11 h-11 rounded-xl bg-mist">
                      <CreditCard className="w-5 h-5 text-cosmic" />
                    </div>
                    {payment === 'card' && <Check className="w-5 h-5 text-cosmic" />}
                  </div>
                  <p className="mt-3 font-heading font-bold">Pay by card</p>
                  <p className="text-sm text-muted-foreground">Pay securely online now</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPayment('cod')}
                  className={`text-left p-5 rounded-2xl border-2 transition-all ${
                    payment === 'cod' ? 'border-cosmic bg-cosmic/5' : 'border-border hover:border-cosmic/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="grid place-items-center w-11 h-11 rounded-xl bg-mist">
                      <Banknote className="w-5 h-5 text-cosmic" />
                    </div>
                    {payment === 'cod' && <Check className="w-5 h-5 text-cosmic" />}
                  </div>
                  <p className="mt-3 font-heading font-bold">Cash on delivery</p>
                  <p className="text-sm text-muted-foreground">Pay when it arrives</p>
                </button>
              </div>

              {payment === 'card' && (
                <div className="mt-6 rounded-2xl bg-mist p-5 space-y-4 float-in">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Lock className="w-3.5 h-3.5" /> Encrypted & secure. Card details are processed by your payment gateway.
                  </div>
                  <Field label="Card number" required value={card.number} onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))} placeholder="4242 4242 4242 4242" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Expiry" required value={card.expiry} onChange={(e) => setCard((c) => ({ ...c, expiry: e.target.value }))} placeholder="MM / YY" />
                    <Field label="CVC" required value={card.cvc} onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))} placeholder="123" />
                  </div>
                </div>
              )}

              {payment === 'cod' && (
                <div className="mt-6 rounded-2xl bg-accent/10 border border-accent/30 p-5 flex items-start gap-3 float-in">
                  <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-heading font-bold text-sm">How cash on delivery works</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Your order is reserved now. When it arrives, our courier verifies your identity and
                      you pay in cash — no card needed. Simple, trusted, frictionless.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="lg:sticky lg:top-28 h-fit rounded-3xl bg-mist p-6 md:p-8">
            <h2 className="font-heading font-extrabold text-2xl">Your order</h2>
            <div className="mt-5 space-y-4 max-h-72 overflow-auto pr-1">
              {items.map((i) => (
                <div key={i.id} className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{i.name} × {i.qty}</span>
                  <span className="font-heading font-bold">${(i.price * i.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-5 border-t border-border/60 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-heading font-bold">${total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery</span>
                <span className="font-heading font-bold text-cosmic">Free</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border/60 flex justify-between items-center">
              <span className="font-heading font-bold">Total</span>
              <span className="font-heading font-extrabold text-2xl">${total.toFixed(2)}</span>
            </div>

            <button
              type="submit"
              disabled={placing}
              className="squish mt-6 w-full h-14 rounded-full bg-cosmic text-white font-heading font-bold inline-flex items-center justify-center gap-2 hover:bg-primary transition-colors disabled:opacity-60"
            >
              {placing ? 'Placing order…' : payment === 'card' ? 'Pay now' : 'Reserve order'}
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {payment === 'card' ? 'You will be charged on confirmation' : 'No payment until delivery'}
            </p>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
}

function Field({ label, required, value, onChange, placeholder, type = 'text' }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/80">
        {label}{required && <span className="text-accent"> *</span>}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1.5 w-full h-12 px-4 rounded-2xl bg-mist border border-border focus:outline-none focus:ring-2 focus:ring-cosmic/40 focus:border-cosmic"
      />
    </label>
  );
}