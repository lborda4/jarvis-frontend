import { Navigate, Route, Routes } from 'react-router-dom'
import AdminRoute from './components/AdminRoute'
import DefaultAppRedirect from './components/DefaultAppRedirect'
import ProtectedRoute from './components/ProtectedRoute'
import SupportDocumentRoute from './components/SupportDocumentRoute'
import TercerosRoute from './components/TercerosRoute'
import JarvisIntegrationRoute from './components/JarvisIntegrationRoute'
import SiigoIntegrationRoute from './components/SiigoIntegrationRoute'
import { AuthProvider } from './context/AuthContext'
import { SiigoSetupProvider } from './context/SiigoSetupContext'
import { SiigoCatalogProvider } from './context/SiigoCatalogContext'
import { ImportSessionProvider } from './context/ImportSessionContext'
import AppLayout from './layout/AppLayout'
import LoginPage from './pages/LoginPage'
import LandingPage from './pages/LandingPage'
import RegisterPage from './pages/RegisterPage'

function App() {
  return (
    <AuthProvider>
      <SiigoSetupProvider>
        <SiigoCatalogProvider>
          <ImportSessionProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />
            <Route path="/admin" element={<AdminRoute />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/inicio" element={<DefaultAppRedirect />} />

                <Route
                  path="/documento-soporte"
                  element={<SupportDocumentRoute />}
                />
                <Route
                  path="/documento-soporte/masivo"
                  element={<SupportDocumentRoute view="workspace" />}
                />
                <Route
                  path="/documento-soporte/nuevo"
                  element={<SupportDocumentRoute view="individual" />}
                />
                <Route
                  path="/documento-soporte/importar"
                  element={<Navigate to="/documento-soporte" replace />}
                />
                <Route
                  path="/documento-soporte/historial"
                  element={<Navigate to="/documento-soporte" replace />}
                />

                <Route path="/terceros" element={<TercerosRoute />} />

                <Route
                  path="/factura-compra/*"
                  element={<Navigate to="/documento-soporte" replace />}
                />

                <Route
                  path="/configuracion/integracion-siigo"
                  element={<SiigoIntegrationRoute />}
                />
                <Route
                  path="/configuracion/integracion-jarvis"
                  element={<JarvisIntegrationRoute />}
                />

                <Route
                  path="/facturas/*"
                  element={<Navigate to="/documento-soporte" replace />}
                />
                <Route path="*" element={<DefaultAppRedirect />} />
              </Route>
            </Route>
          </Routes>
          </ImportSessionProvider>
        </SiigoCatalogProvider>
      </SiigoSetupProvider>
    </AuthProvider>
  )
}

export default App
