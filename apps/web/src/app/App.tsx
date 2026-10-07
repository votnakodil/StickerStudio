import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from './providers/AppProviders'
import { AnimatedRoutes } from './routes/AnimatedRoutes'

export default function App() {
  return <BrowserRouter useTransitions={false}><AppProviders><AnimatedRoutes /></AppProviders></BrowserRouter>
}
