import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SceneGraphView } from './components/graph/SceneGraphView.tsx'

const isGraphMode = new URLSearchParams(window.location.search).get('mode') === 'graph';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isGraphMode ? <SceneGraphView /> : <App />}
  </StrictMode>,
)
