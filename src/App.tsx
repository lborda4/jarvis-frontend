import { Navigate, Route, Routes } from 'react-router-dom'
import DefaultAppRedirect from './components/DefaultAppRedirect'
import ProtectedRoute from './components/ProtectedRoute'
import SupportDocumentRoute from './components/SupportDocumentRoute'
import { AuthProvider } from './context/AuthContext'
import { SiigoSetupProvider } from './context/SiigoSetupContext'
import { ImportSessionProvider } from './context/ImportSessionContext'
import AppLayout from './layout/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SiigoIntegrationSettings from './pages/SiigoIntegrationSettings'

function App() {
  return (
    <AuthProvider>
      <SiigoSetupProvider>
        <ImportSessionProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/registro" element={<RegisterPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<DefaultAppRedirect />} />

                <Route
                  path="/documento-soporte"
                  element={<SupportDocumentRoute />}
                />
                <Route
                  path="/documento-soporte/importar"
                  element={<Navigate to="/documento-soporte" replace />}
                />
                <Route
                  path="/documento-soporte/historial"
                  element={<Navigate to="/documento-soporte" replace />}
                />

                <Route
                  path="/configuracion/integracion-siigo"
                  element={<SiigoIntegrationSettings />}
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
      </SiigoSetupProvider>
    </AuthProvider>
  )
}

export default App
