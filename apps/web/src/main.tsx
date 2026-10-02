import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'virtual:sticker-studio-colors.css'
import './styles/global.css'
import App from '@/app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
