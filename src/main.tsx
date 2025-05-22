import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Antrian from './Antrian.tsx'
import Monitor from './Monitor.tsx'
import Status from './Status.tsx'
import Homepage from './Homepage.tsx'
import NotFound from './NotFound.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="*" element={<NotFound />} />
        <Route path="/create" element={<Antrian />} />
        <Route path="/monitor" element={<Monitor />} />
        <Route path="/check-status/:id" element={<Status />} />
      </Routes>
    </Router>
  </StrictMode>,
)
