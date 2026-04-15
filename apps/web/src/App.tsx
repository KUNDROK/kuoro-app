import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { AdminRegisterPage } from "./pages/AdminRegisterPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { PropertyWizardPage } from "./pages/PropertyWizardPage";
import { UnitsSetupPage } from "./pages/UnitsSetupPage";
import { UnitsListPage } from "./pages/UnitsListPage";
import { UnitDetailPage } from "./pages/UnitDetailPage";
import { ProxyUploadPage } from "./pages/ProxyUploadPage";
import { PropertyOverviewPage } from "./pages/PropertyOverviewPage";
import { AssemblyListPage } from "./pages/AssemblyListPage";
import { AssemblyHubPage } from "./pages/AssemblyHubPage";
import { AssemblyRoomPage } from "./pages/AssemblyRoomPage";
import { AttendeeRoomPage } from "./pages/AttendeeRoomPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { DocumentRequestStatusPage } from "./pages/DocumentRequestStatusPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ChoosePlanPage } from "./pages/ChoosePlanPage";
import { CheckoutSummaryPage } from "./pages/CheckoutSummaryPage";
import { SalesContactPage } from "./pages/SalesContactPage";
import { LegalNoticePage } from "./pages/LegalNoticePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/contratar" element={<ChoosePlanPage />} />
      <Route path="/contratar/resumen" element={<CheckoutSummaryPage />} />
      <Route path="/contacto-ventas" element={<SalesContactPage />} />
      <Route path="/legal/:slug" element={<LegalNoticePage />} />
      <Route path="/registro-admin" element={<AdminRegisterPage />} />
      <Route path="/login-admin" element={<AdminLoginPage />} />
      <Route path="/crear-copropiedad" element={<PropertyWizardPage mode="create" />} />
      <Route path="/editar-copropiedad" element={<PropertyWizardPage mode="edit" />} />
      <Route path="/unidades-iniciales" element={<UnitsSetupPage />} />
      <Route path="/unidades" element={<UnitsListPage />} />
      <Route path="/unidades/:unitId" element={<UnitDetailPage />} />
      <Route path="/poder/:token" element={<ProxyUploadPage />} />
      <Route path="/documento/:token" element={<DocumentRequestStatusPage />} />
      <Route path="/dashboard" element={<AdminDashboardPage />} />
      <Route path="/copropiedad" element={<PropertyOverviewPage />} />
      <Route path="/asambleas" element={<AssemblyListPage />} />
      <Route path="/asambleas/:assemblyId" element={<AssemblyHubPage />} />
      <Route path="/sala/:propertyId/:assemblyId" element={<AssemblyRoomPage />} />
      {/* Sala pública para asistentes — sin autenticación admin */}
      <Route path="/asistente/:propertyId/:assemblyId" element={<AttendeeRoomPage />} />
      <Route path="/asistente" element={<AttendeeRoomPage />} />
      <Route path="/comunicaciones" element={<CommunicationsPage />} />
      <Route path="/reportes" element={<ReportsPage />} />
      <Route path="/configuracion" element={<SettingsPage />} />
    </Routes>
  );
}
