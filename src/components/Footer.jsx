import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Instagram, Facebook, Twitter } from 'lucide-react';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!email) return;
    setSent(true);
    setEmail('');
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <footer className="mt-32 bg-cosmic text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-24 md:py-32">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-white/60 font-medium">
              Join the Club
            </p>
            <h2 className="mt-4 font-heading font-extrabold text-4xl md:text-6xl leading-[1.05] text-balance">
              Wonder, delivered to your inbox.
            </h2>
            <p className="mt-5 text-white/70 max-w-md text-lg">
              Early access to new worlds of play, slow-toy stories, and members-only offers.
            </p>
          </div>
          <form onSubmit={submit} className="md:justify-self-end w-full max-w-md">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 h-14 px-6 rounded-full bg-white/10 border border-white/20 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
              <button
                type="submit"
                className="squish h-14 px-8 rounded-full bg-white text-cosmic font-heading font-bold hover:bg-accent hover:text-white transition-colors"
              >
                {sent ? 'Welcome!' : 'Join'}
              </button>
            </div>
            <p className="mt-3 text-xs text-white/50">
              By joining you agree to our playful privacy policy.
            </p>
          </form>
        </div>

        <div className="mt-24 pt-10 border-t border-white/15 grid md:grid-cols-4 gap-10">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-white text-cosmic font-heading font-extrabold text-lg">
                H
              </span>
              <span className="font-heading font-extrabold text-xl">HiKids</span>
            </Link>
            <p className="mt-4 text-white/60 text-sm max-w-xs">
              A gallery of wonder. Premium toys for sophisticated play, made to be treasured.
            </p>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white/50">Shop</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li><a href="/#explore" className="hover:text-white">All Toys</a></li>
              <li><a href="/#categories" className="hover:text-white">Worlds of Play</a></li>
              <li><a href="/#promise" className="hover:text-white">Our Promise</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white/50">Company</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li><a href="/#about" className="hover:text-white">About</a></li>
              <li><a href="#" className="hover:text-white">Careers</a></li>
              <li><a href="#" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-white/50">Follow</h4>
            <div className="mt-4 flex gap-3">
              <a href="#" aria-label="Instagram" className="grid place-items-center w-11 h-11 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Instagram className="w-5 h-5" /></a>
              <a href="#" aria-label="Facebook" className="grid place-items-center w-11 h-11 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Facebook className="w-5 h-5" /></a>
              <a href="#" aria-label="Twitter" className="grid place-items-center w-11 h-11 rounded-full bg-white/10 hover:bg-white hover:text-cosmic transition-colors"><Twitter className="w-5 h-5" /></a>
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <p>© {new Date().getFullYear()} HiKids. All wonder reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white">Privacy</a>
            <a href="#" className="hover:text-white">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}