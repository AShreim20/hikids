import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initGA } from '@/lib/ga4'

// Once per real page load (module-level flag in ga4.js) — a no-op outside a
// real production build on the real hikids-ps.com origin.
initGA()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
