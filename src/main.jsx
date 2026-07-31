import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import BookingPage from './pages/BookingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import HomePage from './pages/HomePage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ConfiguracionPage from './pages/ConfiguracionPage.jsx'
import RegistroPage from './pages/RegistroPage.jsx'
import DisponibilidadPage from './pages/DisponibilidadPage.jsx'
import ServiciosPage from './pages/ServiciosPage.jsx'
import AparienciaPage from './pages/AparienciaPage.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/panel" element={<DashboardPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/panel/configuracion" element={<ConfiguracionPage />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/panel/disponibilidad" element={<DisponibilidadPage />} />
        <Route path="/panel/servicios" element={<ServiciosPage />} />
        <Route path="/panel/apariencia" element={<AparienciaPage />} />
        <Route path="/:slug" element={<BookingPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
