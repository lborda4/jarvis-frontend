import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import { ImportSessionProvider } from './context/ImportSessionContext'
import ImportHistory from './components/ImportHistory'
import ImportModule from './components/ImportModule'
import { IMPORT_MODULE_COPY } from './constants/importModuleCopy'
import AppLayout from './layout/AppLayout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SupportDocumentPage from './pages/SupportDocumentPage'
import SiigoIntegrationSettings from './pages/SiigoIntegrationSettings'

function App() {
  return (
    <AuthProvider>
      <ImportSessionProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/registro" element={<RegisterPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/facturas/importar" replace />} />

              <Route
                path="/facturas/importar"
                element={
                  <ImportModule
                    title={IMPORT_MODULE_COPY.invoice.importTitle}
                    description={IMPORT_MODULE_COPY.invoice.importDescription}
                    electronicDocumentType={
                      IMPORT_MODULE_COPY.invoice.electronicDocumentType
                    }
                    integration="siigo"
                  />
                }
              />
              <Route
                path="/facturas/historial"
                element={
                  <ImportHistory
                    title={IMPORT_MODULE_COPY.invoice.historyTitle}
                    electronicDocumentType={
                      IMPORT_MODULE_COPY.invoice.electronicDocumentType
                    }
                  />
                }
              />

              <Route path="/documento-soporte" element={<SupportDocumentPage />} />
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

              <Route path="*" element={<Navigate to="/facturas/importar" replace />} />
            </Route>
          </Route>
        </Routes>
      </ImportSessionProvider>
    </AuthProvider>
  )
}

export default App
