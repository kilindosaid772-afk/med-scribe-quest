import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import PatientDashboard from "./pages/PatientDashboard";
import LabDashboard from "./pages/LabDashboard";
import PharmacyDashboard from "./pages/PharmacyDashboard";
import BillingDashboard from "./pages/BillingDashboard";
import NurseDashboard from "./pages/NurseDashboard";
import ReceptionistDashboard from "./pages/ReceptionistDashboard";
import DischargeDashboard from "./pages/DischargeDashboard";
import MedicalServicesDashboard from "./pages/MedicalServicesDashboard";
import ActivityLogs from "./pages/ActivityLogs";
import PaymentSuccess from "./pages/PaymentSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor"
              element={
                <ProtectedRoute requiredRole="doctor">
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient"
              element={
                <ProtectedRoute>
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lab"
              element={
                <ProtectedRoute requiredRole="lab_tech">
                  <LabDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pharmacy"
              element={
                <ProtectedRoute requiredRole="pharmacist">
                  <PharmacyDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <ProtectedRoute requiredRole="billing">
                  <BillingDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nurse"
              element={
                <ProtectedRoute requiredRole="nurse">
                  <NurseDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receptionist"
              element={
                <ProtectedRoute requiredRole="receptionist">
                  <ReceptionistDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/discharge"
              element={
                <ProtectedRoute requiredRole="receptionist">
                  <DischargeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <MedicalServicesDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute requiredRole="admin">
                  <ActivityLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/billing/payment-success"
              element={<PaymentSuccess />}
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
