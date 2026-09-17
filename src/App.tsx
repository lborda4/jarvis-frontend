import { Navigate, Route, Routes } from 'react-router-dom'
import AdminRoute from './components/AdminRoute'
import DefaultAppRedirect from './components/DefaultAppRedirect'
import ProtectedRoute from './components/ProtectedRoute'
import SupportDocumentRoute from './components/SupportDocumentRoute'
import PurchaseInvoiceRoute from './components/PurchaseInvoiceRoute'
import BankStatementClosingPage from './pages/BankStatementClosingPage'
import BankStatementHistoryPage from './pages/BankStatementHistoryPage'
import CreateProductPage from './pages/CreateProductPage'
import ProductListPage from './pages/ProductListPage'
import ClientProductsRoute from './components/ClientProductsRoute'
import TercerosRoute from './components/TercerosRoute'
import JarvisIntegrationRoute from './components/JarvisIntegrationRoute'
import SiigoIntegrationRoute from './components/SiigoIntegrationRoute'
import { AuthProvider } from './context/AuthContext'
import { SiigoSetupProvider } from './context/SiigoSetupContext'
import { SiigoCatalogProvider } from './context/SiigoCatalogContext'
import { ImportSessionProvider } from './context/ImportSessionContext'
import AppLayout from './layout/AppLayout'
import SalesInvoicePage from './pages/SalesInvoicePage'
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
                  element={<Navigate to="/documento-soporte/nuevo" replace />}
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

                <Route path="/factura-compra" element={<PurchaseInvoiceRoute />} />
                <Route path="/factura-venta" element={<SalesInvoicePage />} />

                <Route path="/terceros" element={<TercerosRoute />} />

                <Route element={<ClientProductsRoute />}>
                  <Route
                    path="/productos"
                    element={<Navigate to="/productos/crear" replace />}
                  />
                  <Route path="/productos/crear" element={<CreateProductPage />} />
                  <Route path="/productos/listar" element={<ProductListPage />} />
                </Route>

                <Route
                  path="/extractos-bancarios"
                  element={<Navigate to="/extractos-bancarios/cargar" replace />}
                />
                <Route
                  path="/extractos-bancarios/cargar"
                  element={<BankStatementClosingPage />}
                />
                <Route
                  path="/extractos-bancarios/historial"
                  element={<BankStatementHistoryPage />}
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
