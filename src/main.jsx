import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import SpeedReader from './SpeedReader'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SpeedReader />
  </StrictMode>
)
