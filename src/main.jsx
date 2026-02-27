import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import SpeedReader from './SpeedReader'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SpeedReader />
    <Analytics />
  </StrictMode>
)
