import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import SpeedReader from './SpeedReader'
import { SpeedInsights } from "@vercel/speed-insights/react"


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SpeedReader />
    <Analytics />
    <SpeedInsights/>
  </StrictMode>
)
