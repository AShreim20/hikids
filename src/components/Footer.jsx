import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Twitter } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="hidden md:block mt-32 bg-cosmic text-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 md:py-20">
        <div className="grid md:grid-cols-4 gap-10">
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

        <div className="mt-12 pt-8 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/50">
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