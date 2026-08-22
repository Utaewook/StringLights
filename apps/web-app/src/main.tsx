import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/ds/index.css'
import './index.css'
import App from './App.tsx'
// Must stay last: it overrides the legacy token block in App.css. See styles/bridge.css.
import './styles/bridge.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
