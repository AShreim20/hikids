import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

// Last-resort fallback for an uncaught React render error — not a form/API
// error handler (those already catch and show inline messages where that's
// the feature; this never runs for those). Rendered as a normal function
// component so it can use the existing translation system (`useLanguage`)
// like every other page — the class boundary below can't use hooks itself,
// so it only catches the error and defers the actual UI to this component.
function ErrorFallback() {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-background grid place-items-center px-5">
      <div className="max-w-sm text-center">
        <div className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-destructive/10">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="mt-6 font-heading font-extrabold text-2xl">{t('error.title')}</h1>
        <p className="mt-3 text-muted-foreground">{t('error.desc')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="squish mt-6 inline-flex items-center gap-2 h-12 px-6 rounded-full bg-cosmic text-white font-heading font-bold"
        >
          {t('error.reload')}
        </button>
      </div>
    </div>
  );
}

// A React error boundary must be a class component (getDerivedStateFromError/
// componentDidCatch have no hook equivalent). Deliberately minimal: it only
// catches an uncaught render exception anywhere in its subtree and swaps to
// the fallback above — normal checkout/API/form error handling is untouched
// and never reaches this (those catch their own errors and render inline,
// they never throw during render).
export default class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Developer-facing only — never shown to the customer. No stack trace,
    // token, or internal API detail ever reaches ErrorFallback's own props.
    console.error('Uncaught render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) return <ErrorFallback />;
    return this.props.children;
  }
}
