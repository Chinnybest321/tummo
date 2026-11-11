import './polyfill.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/bricolage-grotesque/400.css'
import '@fontsource/bricolage-grotesque/500.css'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/bricolage-grotesque/800.css'
import './index.css'
import App from './App.jsx'

const root = createRoot(document.getElementById('root'))
const render = (Wrap) =>
  root.render(
    <StrictMode>
      {Wrap ? <Wrap><App /></Wrap> : <App />}
    </StrictMode>,
  )

// X sign-in loads only when a Privy app is configured
if (import.meta.env.VITE_PRIVY_APP_ID) {
  import('./auth/PrivyRoot.jsx').then((m) => render(m.default))
} else {
  render(null)
}
