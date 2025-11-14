import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { format, parseISO, isSameDay, formatDistanceToNow } from 'date-fns';
import { cn } from "@/lib/utils";
import 'highlight.js/styles/github.css'; // For JSON syntax highlighting
import { 
  Search, 
  X, 
  Calendar as CalendarIcon, 
  Users, 
  UserPlus, 
  Activity, 
  Loader2, 
  Stethoscope, 
  DollarSign, 
  Edit, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Eye, 
  FileText, 
  User, 
  ClipboardList, 
  Shield, 
  Phone, 
  Mail, 
  Home, 
  Clock, 
  Pill, 
  AlertTriangle, 
  FilePlus, 
  FileCheck, 
  FileX, 
  FileSearch,
  Stethoscope as StethoscopeIcon,
  FileText as FileTextIcon
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { StatCard } from '@/components/StatCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { supabaseAdmin } from '@/integrations/supabase/admin';
import { toast } from 'sonner';
import { logActivity } from '@/lib/utils';
import AdminReports from '@/components/AdminReports';
import ActivityLogsView from '@/components/ActivityLogsView';
// Using dynamic import for code splitting
const EnhancedAppointmentBooking = React.lazy(() => import('@/components/EnhancedAppointmentBooking'));

// Define the Patient interface at the top level
type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  date_of_birth: string;
  gender: string;
  phone: string;
  email?: string;
  address?: string;
  blood_group?: string | null;
  status: 'Active' | 'Inactive' | 'Pending' | string;
  medical_history?: string;
  allergies?: string;
  medications?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
  created_at: string;
  updated_at: string;
};

type MedicalRecord = {
  id: string;
  patient_id: string;
  record_type: 'Diagnosis' | 'Prescription' | 'Lab Result' | 'Note' | 'Other';
  title: string;
  description: string;
  date: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Appointment = {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  appointment_time: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
  reason: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  doctor?: {
    full_name: string;
    specialization?: string;
  };
};

// Patient Detail View Component
interface PatientDetailViewProps {
  patient: Patient | null;
  records: MedicalRecord[];
  appointments: Appointment[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onClose: () => void;
  loading: boolean;
  isLoadingRecords?: boolean;
}

const PatientDetailView: React.FC<PatientDetailViewProps> = ({
  patient,
  records = [],
  appointments = [],
  activeTab = 'overview',
  onTabChange,
  onClose,
  loading = false,
  isLoadingRecords = false
}) => {
  if (!patient) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">No patient selected</p>
      </div>
    );
  }
  
  // Default values for optional fields
  const {
    full_name = '',
    first_name = '',
    last_name = '',
    date_of_birth = '',
    gender = '',
    phone = '',
    email = '',
    address = '',
    blood_group = null,
    medical_history = '',
    allergies = '',
    medications = '',
    insurance_provider = '',
    insurance_policy_number = ''
  } = patient;

  const formatDate = (dateString?: string) => {
    return dateString ? format(new Date(dateString), 'MMM d, yyyy') : 'N/A';
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  return (
    <Dialog open={!!patient} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {full_name || `${first_name} ${last_name}`.trim()}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {gender} • {calculateAge(date_of_birth)} years • {blood_group || 'N/A'}
            </span>
          </DialogTitle>
          <DialogDescription>
            Patient ID: {patient.id}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b">
          <div className="flex space-x-4">
            {['overview', 'records', 'appointments'].map((tab) => (
              <button
                key={tab}
                type="button"
                className={`py-2 px-4 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => onTabChange(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          {loading && (
            <div className="flex items-center justify-center p-8">
              <p>Loading patient data...</p>
            </div>
          )}
          {!loading && activeTab === 'overview' && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Personal Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p>{formatDate(date_of_birth)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Age</p>
                      <p>{calculateAge(date_of_birth)} years</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Mail className="h-4 w-4 mr-1" /> Email
                    </p>
                    <p>{email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Phone className="h-4 w-4 mr-1" /> Phone
                    </p>
                    <p>{phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Home className="h-4 w-4 mr-1" /> Address
                    </p>
                    <p>{address || 'N/A'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center space-x-2">
                    <StethoscopeIcon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle>Medical Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <FileTextIcon className="h-4 w-4 mr-1" /> Medical History
                    </p>
                    <p className="whitespace-pre-line mt-1">
                      {medical_history || 'No medical history recorded'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" /> Allergies
                    </p>
                    <p className="whitespace-pre-line mt-1">
                      {allergies || 'No known allergies'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Pill className="h-4 w-4 mr-1 text-blue-500" /> Current Medications
                    </p>
                    <p className="whitespace-pre-line mt-1">
                      {medications || 'No current medications'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <CardTitle>Insurance Information</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" className="h-8">
                      <FilePlus className="h-4 w-4 mr-2" />
                      Update Insurance
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Provider</p>
                        <p className="font-medium">{patient.insurance_provider || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Policy Number</p>
                        <p className="font-mono">{patient.insurance_policy_number || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        
        {activeTab === 'records' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Medical Records
              </h3>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Record
              </Button>
            </div>
            
            {isLoadingRecords ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : records.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No medical records found for this patient.</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Created By</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>{format(new Date(record.date), 'MMM d, yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{record.record_type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{record.title}</TableCell>
                            <TableCell className="max-w-xs truncate">
                              {record.description.substring(0, 50)}{record.description.length > 50 ? '...' : ''}
                            </TableCell>
                            <TableCell>{record.created_by}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

          
          {activeTab === 'appointments' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2" />
                  Appointments
                </h3>
                <Button variant="outline" size="sm" className="h-8">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Appointment
                </Button>
              </div>
              
              {appointments.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground" />
                  <h4 className="mt-3 font-medium text-muted-foreground">No appointments scheduled</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Schedule a new appointment to get started
                  </p>
                  <Button variant="outline" size="sm" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Appointment
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Doctor</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {appointments.map((appointment) => (
                        <TableRow key={appointment.id}>
                          <TableCell>{format(new Date(appointment.appointment_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                              {appointment.appointment_time}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {appointment.doctor?.full_name || 'N/A'}
                            </div>
                            {appointment.doctor?.specialization && (
                              <p className="text-xs text-muted-foreground">
                                {appointment.doctor.specialization}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {appointment.reason}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                appointment.status === 'Completed' ? 'default' :
                                appointment.status === 'Scheduled' ? 'secondary' :
                                appointment.status === 'Cancelled' ? 'destructive' :
                                'outline'
                              }
                            >
                              {appointment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="max-w-sm">
                                <div className="space-y-1 text-sm">
                                  <div><span className="text-muted-foreground">Doctor:</span> {appointment.doctor?.full_name || 'N/A'}</div>
                                  <div><span className="text-muted-foreground">Status:</span> {appointment.status}</div>
                                  <div><span className="text-muted-foreground">Reason:</span> {appointment.reason || 'N/A'}</div>
                                  <div><span className="text-muted-foreground">Time:</span> {appointment.appointment_time}</div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface PatientViewProps {
  patients: Patient[];
  view: 'day' | 'week' | 'all';
  onViewChange: (view: 'day' | 'week' | 'all') => void;
  loading: boolean;
  onViewPatient: (patient: Patient) => void;
  selectedPatient: Patient | null;
  patientRecords: MedicalRecord[];
  patientAppointments: Appointment[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onClosePatientView: () => void;
  isLoadingRecords: boolean;
}

const PatientView: React.FC<PatientViewProps> = ({
  patients,
  view,
  onViewChange,
  loading,
  onViewPatient,
  selectedPatient,
  patientRecords,
  patientAppointments,
  activeTab,
  onTabChange,
  onClosePatientView,
  isLoadingRecords
}) => {
  const filteredPatients = useMemo(() => {
    const now = new Date();
    return patients.filter(patient => {
      const patientDate = new Date(patient.created_at);
      
      switch (view) {
        case 'day':
          return patientDate.toDateString() === now.toDateString();
        case 'week': {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          return patientDate >= weekAgo;
        }
        case 'all':
        default:
          return true;
      }
    });
  }, [patients, view]);

  const viewLabels = {
    day: 'Today',
    week: 'This Week',
    all: 'All Patients'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle>Patients Overview</CardTitle>
        <div className="flex items-center gap-2">
          {(['day', 'week', 'all'] as const).map((tab) => (
            <Button
              key={tab}
              variant={view === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewChange(tab)}
              className="h-8"
            >
              {viewLabels[tab]}
            </Button>
          ))}
        </div>
      </div>
      
      <CardDescription>
        Viewing {filteredPatients.length} {view !== 'all' ? viewLabels[view].toLowerCase() : 'total'} patients
      </CardDescription>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Date of Birth</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Visit</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading patients...</p>
                </TableCell>
              </TableRow>
            ) : filteredPatients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No patients found
                </TableCell>
              </TableRow>
            ) : (
              filteredPatients.map((patient) => (
                <TableRow key={patient.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <div>
                      {patient.full_name || `${patient.first_name} ${patient.last_name}`}
                      {patient.email && (
                        <p className="text-xs text-muted-foreground">{patient.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(patient.date_of_birth), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>{patient.gender}</TableCell>
                  <TableCell>{patient.phone}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        patient.status === 'Active' ? 'default' :
                        patient.status === 'Inactive' ? 'secondary' :
                        'outline'
                      }
                    >
                      {patient.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {patient.updated_at ? format(new Date(patient.updated_at), 'MMM d, yyyy') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0"
                      onClick={() => onViewPatient(patient)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Patient Detail View */}
      <PatientDetailView
        patient={selectedPatient}
        records={patientRecords}
        appointments={patientAppointments}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onClose={onClosePatientView}
        loading={isLoadingRecords}
      />
    </div>
  );
};

// Billing Analysis Component
const BillingAnalysis = () => {
  const [billingStats, setBillingStats] = useState({
    totalRevenue: 0,
    unpaidAmount: 0,
    paidToday: 0,
    invoiceCount: 0,
    paidCount: 0,
    unpaidCount: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'day' | 'week' | 'month'>('day');

  useEffect(() => {
    fetchBillingData();
  }, [timeFilter]);

  const fetchBillingData = async () => {
    try {
      // Calculate date range based on filter
      const now = new Date();
      let startDate: Date;
      
      switch (timeFilter) {
        case 'day':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case 'month':
          startDate = new Date(now.setMonth(now.getMonth() - 1));
          break;
      }

      const startDateStr = startDate.toISOString();

      // Fetch recent invoices with filter
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          *,
          patient:patients(full_name)
        `)
        .gte('invoice_date', startDateStr)
        .order('invoice_date', { ascending: false })
        .limit(10);

      // Calculate statistics with filter
      const { data: allInvoices } = await supabase
        .from('invoices')
        .select('total_amount, paid_amount, status, invoice_date')
        .gte('invoice_date', startDateStr);

      if (allInvoices) {
        const totalRevenue = allInvoices
          .filter(inv => inv.status === 'Paid')
          .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

        const unpaidAmount = allInvoices
          .filter(inv => inv.status !== 'Paid')
          .reduce((sum, inv) => sum + (Number(inv.total_amount) - Number(inv.paid_amount || 0)), 0);

        const paidInPeriod = allInvoices
          .filter(inv => inv.status === 'Paid')
          .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

        setBillingStats({
          totalRevenue,
          unpaidAmount,
          paidToday: paidInPeriod,
          invoiceCount: allInvoices.length,
          paidCount: allInvoices.filter(inv => inv.status === 'Paid').length,
          unpaidCount: allInvoices.filter(inv => inv.status === 'Unpaid').length
        });
      }

      setRecentInvoices(invoices || []);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getFilterLabel = () => {
    switch (timeFilter) {
      case 'day': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Showing:</span>
          <div className="flex gap-2">
            <Button
              variant={timeFilter === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeFilter('day')}
            >
              Today
            </Button>
            <Button
              variant={timeFilter === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeFilter('week')}
            >
              This Week
            </Button>
            <Button
              variant={timeFilter === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeFilter('month')}
            >
              This Month
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              TSh {billingStats.totalRevenue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {billingStats.paidCount} paid invoices
            </p>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700">Unpaid Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              TSh {billingStats.unpaidAmount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {billingStats.unpaidCount} unpaid invoices
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Paid Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              TSh {billingStats.paidToday.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Today's collections
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <div>
        <h3 className="text-sm font-medium mb-3">Recent Invoices</h3>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm">{invoice.invoice_number}</TableCell>
                  <TableCell>{invoice.patient?.full_name || 'Unknown'}</TableCell>
                  <TableCell>TSh {Number(invoice.total_amount).toLocaleString()}</TableCell>
                  <TableCell>TSh {Number(invoice.paid_amount || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invoice.status === 'Paid' ? 'success' :
                        invoice.status === 'Partially Paid' ? 'warning' :
                        'destructive'
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(invoice.invoice_date), 'MMM dd, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  interface User {
    id: string;
    email: string;
    full_name?: string;
    phone?: string;
    user_metadata?: {
      full_name?: string;
      avatar_url?: string;
    };
    app_metadata?: {
      provider?: string;
    };
    created_at: string;
    last_sign_in_at?: string;
    role?: string;
    roles?: Array<{
      id: string;
      role: string;
      is_primary: boolean;
    }>;
  }
  
  interface ActivityLog {
    id: string;
    action: string;
    user_id: string;
    user_email?: string;
    user_name?: string;
    details: Record<string, any>;
    created_at: string;
  }

  interface Patient {
    id: string;
    first_name: string;
    last_name: string;
    full_name?: string;
    date_of_birth: string;
    gender: string;
    phone: string;
    email?: string;
    address?: string;
    blood_group?: string | null;
    status: 'Active' | 'Inactive' | 'Pending' | string;
    created_at: string;
    updated_at: string;
  }

  interface MedicalService {
    id: string;
    service_code: string;
    service_name: string;
    service_type: string;
    description?: string;
    base_price: number;
    currency: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientRecords, setPatientRecords] = useState<MedicalRecord[]>([]);
  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [users, setUsers] = useState<Array<User & { activeRole?: string }>>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [selectedActionType, setSelectedActionType] = useState<string>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    phone: ''
  });
  const [stats, setStats] = useState({ 
    totalPatients: 0, 
    activeAppointments: 0, 
    totalUsers: 0, 
    totalServices: 0 
  });
  const [loading, setLoading] = useState(false);
  const [medicalServices, setMedicalServices] = useState<MedicalService[]>([]);
  const [serviceForm, setServiceForm] = useState({
    service_code: '',
    service_name: '',
    service_type: '',
    description: '',
    base_price: 0,
    currency: 'TSh',
    is_active: true
  });
  const [editingService, setEditingService] = useState<MedicalService | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const { user } = useAuth();
  const [patientView, setPatientView] = useState<'day' | 'week' | 'all'>('day');
  const [roleUpdateIndicator, setRoleUpdateIndicator] = useState<string | null>(null);
  
  // Settings state
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState({
    consultation_fee: '50000',
    currency: 'TSh',
    hospital_name: 'Medical Center',
    report_header: 'Healthcare Management System Report',
    enable_appointment_fees: 'true'
  });
  const [departmentFees, setDepartmentFees] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Department management state
  const [showDepartmentDialog, setShowDepartmentDialog] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    const loadUser = async () => {
      if (user?.id) {
        const { data: userData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        // Optionally use userData here if needed
      }
    };
    
    loadUser();
    fetchData();
    fetchSettings();

    // Set up real-time subscriptions for admin dashboard
    const rolesChannel = supabase
      .channel('admin_roles')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'user_roles' },
        (payload) => {
          console.log('User roles updated:', payload);
          
          // Show specific feedback based on the change
          if (payload.eventType === 'INSERT') {
            toast.success(`✅ New ${payload.new.role} role assigned successfully`);
          } else if (payload.eventType === 'UPDATE') {
            const oldRole = payload.old.role;
            const newRole = payload.new.role;
            if (payload.new.is_primary !== payload.old.is_primary) {
              toast.info(`🔄 ${newRole} role set as ${payload.new.is_primary ? 'primary' : 'secondary'}`);
            } else {
              toast.info(`🔄 User role updated from ${oldRole} to ${newRole}`);
            }
          } else if (payload.eventType === 'DELETE') {
            toast.warning(`🗑️ ${payload.old.role} role removed`);
          }
          
          // Refresh data to show updated user lists and roles
          fetchData();
        }
      )
      .subscribe();

    const profilesChannel = supabase
      .channel('admin_profiles')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log('User profiles updated');
          fetchData(); // Refresh data when profiles change
        }
      )
      .subscribe();

    const patientsChannel = supabase
      .channel('admin_patients')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'patients' },
        () => {
          console.log('Patients updated');
          fetchData(); // Refresh data when patients change
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(rolesChannel);
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(patientsChannel);
    };
  }, [user]);

  // Filter patients based on selected time period
  const filterPatientsByTime = useCallback((patientsList: Patient[], period: 'day' | 'week' | 'all') => {
    const now = new Date();
    
    return patientsList.filter(patient => {
      const patientDate = new Date(patient.created_at);
      
      switch (period) {
        case 'day':
          return patientDate.toDateString() === now.toDateString();
        case 'week': {
          const weekAgo = new Date();
          weekAgo.setDate(now.getDate() - 7);
          return patientDate >= weekAgo;
        }
        case 'all':
        default:
          return true;
      }
    });
  }, []);

  // Update filtered patients when patients or view changes
  useEffect(() => {
    if (patients.length > 0) {
      // The filtering is now handled in the PatientView component
    }
  }, [patients, patientView]);

  const fetchActivityLogs = async (userId?: string) => {
    try {
      setLogsLoading(true);
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Filter by user if specified
      if (userId && userId !== 'all') {
        query = query.eq('user_id', userId);
      }

      const { data: logs, error } = await query;
        
      if (error) throw error;
      
      if (!logs) {
        setActivityLogs([]);
        return;
      }
      
      // Get user details for each log
      const logsWithUserInfo = await Promise.all(
        logs.map(async (log: ActivityLog) => {
          if (!log.user_id) return log;
          
          const { data: userData } = await supabase
            .from('profiles')
            .select('full_name, email, avatar_url')
            .eq('id', log.user_id)
            .single();
            
          return {
            ...log,
            user_name: userData?.full_name || 'System',
            user_email: userData?.email || 'system@example.com',
            user_avatar: userData?.avatar_url || ''
          } as ActivityLog;
        })
      );
      
      setActivityLogs(logsWithUserInfo);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      // Fetch system settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('system_settings')
        .select('*');

      if (settingsError) throw settingsError;

      if (settingsData) {
        const settings: any = {};
        settingsData.forEach((setting: any) => {
          settings[setting.key] = setting.value;
        });
        setSystemSettings(prev => ({ ...prev, ...settings }));
      }

      // Fetch departments
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (deptError) throw deptError;
      setDepartments(deptData || []);

      // Fetch department fees
      const { data: feesData, error: feesError } = await supabase
        .from('department_fees')
        .select('*');

      if (feesError && feesError.code !== 'PGRST116') { // Ignore "not found" errors
        console.error('Error fetching department fees:', feesError);
      }

      if (feesData) {
        const fees: Record<string, string> = {};
        feesData.forEach((fee: any) => {
          fees[fee.department_id] = fee.fee_amount.toString();
        });
        setDepartmentFees(fees);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      // Save system settings
      for (const [key, value] of Object.entries(systemSettings)) {
        const { error } = await supabase
          .from('system_settings')
          .upsert({
            key,
            value,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'key'
          });

        if (error) throw error;
      }

      // Save department fees
      for (const [deptId, feeAmount] of Object.entries(departmentFees)) {
        if (feeAmount && parseFloat(feeAmount) > 0) {
          const { error } = await supabase
            .from('department_fees')
            .upsert({
              department_id: deptId,
              fee_amount: parseFloat(feeAmount),
              currency: systemSettings.currency,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'department_id'
            });

          if (error) throw error;
        }
      }

      toast.success('Settings saved successfully');
      setShowSettingsDialog(false);
      await logActivity('settings.update', { settings: systemSettings });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Department management functions
  const handleAddDepartment = () => {
    setEditingDepartment(null);
    setDepartmentForm({ name: '', description: '' });
    setShowDepartmentDialog(true);
  };

  const handleEditDepartment = (dept: any) => {
    setEditingDepartment(dept);
    setDepartmentForm({ name: dept.name, description: dept.description || '' });
    setShowDepartmentDialog(true);
  };

  const handleSaveDepartment = async () => {
    if (!departmentForm.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    try {
      if (editingDepartment) {
        // Update existing department
        const { error } = await supabase
          .from('departments')
          .update({
            name: departmentForm.name,
            description: departmentForm.description
          })
          .eq('id', editingDepartment.id);

        if (error) throw error;
        toast.success('Department updated successfully');
      } else {
        // Create new department
        const { error } = await supabase
          .from('departments')
          .insert([{
            name: departmentForm.name,
            description: departmentForm.description
          }]);

        if (error) throw error;
        toast.success('Department created successfully');
      }

      setShowDepartmentDialog(false);
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('Error saving department:', error);
      toast.error(error.message || 'Failed to save department');
    }
  };

  const handleDeleteDepartment = async (deptId: string) => {
    if (!confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', deptId);

      if (error) throw error;
      toast.success('Department deleted successfully');
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('Error deleting department:', error);
      toast.error(error.message || 'Failed to delete department');
    }
  };

  const fetchData = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    try {
      // Fetch patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Fetch users with their roles
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .limit(20);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        throw usersError;
      }

      console.log('Fetched users data:', usersData);

      // Fetch user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('id, user_id, role, is_primary');

      console.log('Fetched roles data:', rolesData);

      // Combine users with their roles and active role
      const usersWithRoles = usersData?.map(user => {
        const userRoles = rolesData?.filter(r => r.user_id === user.id) || [];
        const activeRole = userRoles.find(r => r.is_primary)?.role || 
                         (userRoles[0]?.role || 'No role assigned');
                          
        return {
          ...user,
          roles: userRoles.map(r => ({
            id: r.id,
            role: r.role,
            is_primary: r.is_primary
          })),
          activeRole
        };
      }) || [];

      console.log('Users with roles:', usersWithRoles);

      // Fetch stats
      const { count: patientCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      const { count: appointmentCount } = await supabase
        .from('appointments')
        .select('*', { count: 'exact', head: true })
        .in('status', ['Scheduled', 'Confirmed']);

      // Fetch medical services
      const { data: servicesData } = await supabase
        .from('medical_services')
        .select('*')
        .order('service_name');

      const { count: servicesCount } = await supabase
        .from('medical_services')
        .select('*', { count: 'exact', head: true });

      setPatients(patientsData || []);
      setUsers(usersWithRoles);
      setMedicalServices(servicesData || []);
      setStats({
        totalPatients: patientCount || 0,
        activeAppointments: appointmentCount || 0,
        totalUsers: usersData?.length || 0,
        totalServices: servicesCount || 0
      });
      
      // Fetch activity logs
      await fetchActivityLogs();
    } catch (error) {
      console.error('Error fetching admin data:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });

      // Set empty data to prevent crashes
      setPatients([]);
      setUsers([]);
      setStats({
        totalPatients: 0,
        activeAppointments: 0,
        totalUsers: 0,
        totalServices: 0
      });

      toast.error(`Failed to load dashboard data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const patientData = {
      full_name: formData.get('fullName') as string,
      date_of_birth: formData.get('dob') as string,
      gender: formData.get('gender') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      address: formData.get('address') as string,
      blood_group: formData.get('bloodGroup') as string,
    };

    try {
      let newUserId: string | null = null;

      // Only attempt to create an auth user if an email is provided
      if (patientData.email && patientData.email.trim().length > 0) {
        const randomPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: patientData.email,
          password: randomPassword,
          options: {
            data: {
              full_name: patientData.full_name,
              phone: patientData.phone,
            },
            emailRedirectTo: undefined,
          },
        });

        if (authError) {
          // If email already exists, try to find the existing user profile by email
          if (authError.message?.toLowerCase().includes('already')) {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', patientData.email)
              .maybeSingle();
            if (existingProfile?.id) {
              newUserId = existingProfile.id;
            } else {
              // Proceed without linking if we cannot resolve the user id
              toast.warning('Email already exists. Patient will be created without linking to user account.');
            }
          } else {
            // Other signup errors: proceed without linking
            toast.warning('Could not create user account. Creating patient without account.');
          }
        } else if (authData?.user?.id) {
          // Use newly created auth user id
          newUserId = authData.user.id;
        }
      }

      // If we think a user exists but the profile trigger may be eventual, double-check via profiles when email present
      if (!newUserId && patientData.email) {
        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', patientData.email)
          .maybeSingle();
        if (profileCheck?.id) {
          newUserId = profileCheck.id;
        }
      }

      // Validate user id via profiles before linking to avoid FK violations
      let finalUserId: string | null = null;
      if (newUserId) {
        const { data: profileById } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', newUserId)
          .maybeSingle();
        if (profileById?.id) {
          finalUserId = profileById.id;
        }
      }

      // Create the patient record (link only if verified)
      const { error: patientError } = await supabase.from('patients').insert([{
        ...patientData,
        user_id: finalUserId,
      }]);

      if (patientError) {
        toast.error('Failed to add patient: ' + patientError.message);
      } else {
        // Assign the patient role if we have a user ID
        if (finalUserId) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert([{
              user_id: finalUserId,
              role: 'patient',
              is_primary: true,
            }]);

          if (roleError) {
            toast.error('Patient created but failed to assign role: ' + roleError.message);
          } else {
            toast.success('Patient added successfully with user account');
            logActivity('patient.create', { full_name: patientData.full_name, linked_user: true });
            setDialogOpen(false);
            fetchData();
          }
        } else {
          toast.success('Patient created successfully (no user account created)');
          logActivity('patient.create', { full_name: patientData.full_name, linked_user: false });
          setDialogOpen(false);
          fetchData();
        }
      }
    } catch (error) {
      console.error('Error creating patient:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleSetPrimaryRole = async (userId: string, roleId: string) => {
    try {
      // First, set all roles for this user to non-primary
      const { error: clearError } = await supabase
        .from('user_roles')
        .update({ is_primary: false })
        .eq('user_id', userId);

      if (clearError) throw clearError;

      // Then set the selected role as primary
      const { error: setError } = await supabase
        .from('user_roles')
        .update({ is_primary: true })
        .eq('id', roleId);

      if (setError) throw setError;

      toast.success('Primary role updated successfully');
      fetchData();
    } catch (error) {
      console.error('Error updating primary role:', error);
      toast.error('Failed to update primary role');
    }
  };

  const generateServiceCode = () => {
    const type = serviceForm.service_type;
    const prefix = type === 'Consultation' ? 'CONS' :
                   type === 'Procedure' ? 'PROC' :
                   type === 'Surgery' ? 'SURG' :
                   type === 'Emergency' ? 'EMER' :
                   type === 'Ward Stay' ? 'WARD' : 'OTHER';
    const code = `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setServiceForm(prev => ({ ...prev, service_code: code }));
  };

  const handleAddService = async () => {
    if (!serviceForm.service_code || !serviceForm.service_name || !serviceForm.service_type || !serviceForm.base_price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('medical_services')
        .insert({
          ...serviceForm,
          is_active: true
        });

      if (error) throw error;

      toast.success('Medical service added successfully!');
      setServiceDialogOpen(false);
      setServiceForm({
        service_code: '',
        service_name: '',
        service_type: '',
        description: '',
        base_price: 0,
        currency: 'TSh',
        is_active: true
      });
      fetchData();
    } catch (error) {
      console.error('Error adding service:', error);
      toast.error('Failed to add medical service');
    }
  };

  const handleEditService = (service: any) => {
    setEditingService(service);
    setServiceForm({
      service_code: service.service_code,
      service_name: service.service_name,
      service_type: service.service_type,
      description: service.description || '',
      base_price: service.base_price,
      currency: service.currency || 'TSh',
      is_active: service.is_active
    });
    setServiceDialogOpen(true);
  };

  const handleUpdateService = async () => {
    if (!editingService) return;

    try {
      const { error } = await supabase
        .from('medical_services')
        .update(serviceForm)
        .eq('id', editingService.id);

      if (error) throw error;

      toast.success('Medical service updated successfully!');
      setServiceDialogOpen(false);
      setEditingService(null);
      setServiceForm({
        service_code: '',
        service_name: '',
        service_type: '',
        description: '',
        base_price: 0,
        currency: 'TSh',
        is_active: true
      });
      fetchData();
    } catch (error) {
      console.error('Error updating service:', error);
      toast.error('Failed to update medical service');
    }
  };

  const handleDeleteService = async (serviceId: string, serviceName: string) => {
    if (!confirm(`Are you sure you want to delete "${serviceName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('medical_services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      toast.success('Medical service deleted successfully!');
      fetchData();
    } catch (error) {
      console.error('Error deleting service:', error);
      toast.error('Failed to delete medical service');
    }
  };

  const resetServiceForm = () => {
    setServiceForm({
      service_code: '',
      service_name: '',
      service_type: '',
      description: '',
      base_price: 0,
      currency: 'TSh',
      is_active: true
    });
    setEditingService(null);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || ''
    });
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userForm.full_name,
          phone: userForm.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingUser.id);
        
      if (error) throw error;
      
      // Update email in auth if changed
      if (userForm.email !== editingUser.email) {
        const { error: emailError } = await supabase.auth.admin.updateUserById(editingUser.id, {
          email: userForm.email
        });
        if (emailError) throw emailError;
      }
      
      toast.success('User updated successfully');
      setEditingUser(null);
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === editingUser.id 
          ? { ...u, full_name: userForm.full_name, phone: userForm.phone, email: userForm.email }
          : u
      ));
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      // First, delete related records to avoid foreign key constraints
      // 1. Delete from user_roles using the admin client
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      
      if (roleError) throw roleError;
      
      // 2. Delete from profiles using the admin client
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', userId);
        
      if (profileError) throw profileError;
      
      // 3. Delete the auth user using the admin client
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) throw authError;
      
      toast.success('User deleted successfully');
      
      // Update local state
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Error deleting user:', error);
      
      // More specific error messages
      if (error instanceof Error) {
        if (error.message.includes('foreign key constraint')) {
          toast.error('Cannot delete user: User has related records in the database');
        } else if (error.message.includes('403')) {
          toast.error('Permission denied: You do not have sufficient permissions to delete users');
        } else {
          toast.error(`Failed to delete user: ${error.message}`);
        }
      } else {
        toast.error('Failed to delete user. Please check the console for details.');
      }
    }
  };

  const handleAssignRole = (user: User) => {
    setSelectedUserId(user.id);
    setRoleDialogOpen(true);
  };

  const handleRoleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!selectedUserId) {
      toast.error('No user selected for role assignment');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const role = (formData.get('role') as string | null)?.trim();
    const isPrimary = formData.get('isPrimary') !== null;

    if (!role) {
      toast.error('Please select a role');
      return;
    }

    try {
      // Check if the user already has this role
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('id, is_primary')
        .eq('user_id', selectedUserId)
        .eq('role', role)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRole) {
        // If role exists, make it the active role
        const { error: clearError } = await supabase
          .from('user_roles')
          .update({ is_primary: false })
          .eq('user_id', selectedUserId)
          .neq('id', existingRole.id);
        
        if (clearError) throw clearError;

        // Set this role as primary
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ is_primary: true })
          .eq('id', existingRole.id);
        
        if (updateError) throw updateError;
        
        // Update the user's active role in your auth context or state
        // This part depends on how you're managing user session/state
        if (selectedUserId === user?.id) {
          // If the current user is changing their own role, update the UI/state
          // You might need to implement a context update or refresh the session
          // For example:
          // updateUserSession({ ...user, activeRole: role });
          // or refresh the session to get the updated roles
          await supabase.auth.refreshSession();
        }
        
        toast.success(`Switched to ${role} role`);
      } else {
        // Role doesn't exist, insert new role
        if (isPrimary) {
          // Clear primary flag from other roles if needed
          const { error: clearError } = await supabase
            .from('user_roles')
            .update({ is_primary: false })
            .eq('user_id', selectedUserId);
          if (clearError) throw clearError;
        }

        const { error: insertError } = await supabase
          .from('user_roles')
          .upsert(
            { 
              user_id: selectedUserId, 
              role, 
              is_primary: isPrimary
            },
            { 
              onConflict: 'user_id,role',
              ignoreDuplicates: false
            }
          )
          .select()
          .single();

        if (insertError) throw insertError;
        
        toast.success('Role assigned successfully');
      }

      // Log the role assignment
      await logActivity('user.role.assigned', {
        user_id: selectedUserId,
        role,
        is_primary: isPrimary
      });

      setRoleDialogOpen(false);
      setSelectedUserId(null);
      
      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.id === selectedUserId) {
          return { ...u, activeRole: isPrimary ? role : u.activeRole };
        }
        return u;
      }));
    } catch (error) {
      console.error('Error assigning role:', error);
      const message = (error as { message?: string })?.message || 'Failed to assign role';
      toast.error(message);
    }
  };

  const handleCSVFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0] || null;
    setImportFile(file);
    setImportPreview([]);
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      setImportPreview(rows.slice(0, 10));
    } catch (err: any) {
      setImportError(err?.message || 'Failed to read CSV file');
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (lines.length === 0) return [];
    const header = lines[0].split(',').map(h => h.trim());
    const required = ['service_code','service_name','service_type','base_price'];
    for (const r of required) {
      if (!header.includes(r)) {
        throw new Error(`Missing required column: ${r}`);
      }
    }
    const idx = (name: string) => header.indexOf(name);
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length === 1 && cols[0].trim() === '') continue;
      const row = {
        service_code: cols[idx('service_code')]?.trim() || '',
        service_name: cols[idx('service_name')]?.trim() || '',
        service_type: cols[idx('service_type')]?.trim() || '',
        description: header.includes('description') ? (cols[idx('description')]?.trim() || '') : '',
        base_price: parseFloat(cols[idx('base_price')] || '0') || 0,
        currency: header.includes('currency') ? (cols[idx('currency')]?.trim() || 'TSh') : 'TSh',
        is_active: header.includes('is_active') ? ((cols[idx('is_active')]?.trim().toLowerCase() === 'true')) : true,
      };
      if (row.service_code && row.service_name && row.service_type && row.base_price > 0) {
        rows.push(row);
      }
    }
    return rows;
  };

  const handleImportServices = async () => {
    if (!importFile) {
      setImportError('Please choose a CSV file');
      return;
    }
    
    setImporting(true);
    setImportError(null);
    
    try {
      const text = await importFile.text();
      const rows = parseCSV(text);
      
      if (rows.length === 0) {
        setImportError('No valid rows found in CSV');
        setImporting(false);
        return;
      }
      
      const { error } = await supabase.from('medical_services').insert(rows);
      
      if (error) throw error;
      
      toast.success(`Imported ${rows.length} services successfully`);
      setImportDialogOpen(false);
      setImportFile(null);
      setImportPreview([]);
      fetchData();
    } catch (err: any) {
      console.error('CSV import error:', err);
      setImportError(err?.message || 'Failed to import CSV');
    } finally {
      setImporting(false);
    }
  };

  const downloadServicesTemplate = () => {
    const csvContent = [
      'service_code,service_name,service_type,description,base_price,currency,is_active',
      'CONS-001,General Consultation,Consultation,General doctor consultation,50000,TSh,true',
      'PROC-001,Blood Test,Procedure,Complete blood count test,25000,TSh,true',
      'SURG-001,Minor Surgery,Surgery,Minor surgical procedure,150000,TSh,true',
      'EMER-001,Emergency Care,Emergency,Emergency room visit,100000,TSh,true',
      'WARD-001,Ward Admission,Ward Stay,General ward per day,75000,TSh,true'
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medical_services_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchPatientRecords = async (patientId: string) => {
    try {
      setIsLoadingRecords(true);
      const { data, error } = await supabase
        .from('patient_services')
        .select(`
          *,
          service:medical_services(*)
        `)
        .eq('patient_id', patientId)
        .order('service_date', { ascending: false });
        
      if (error) throw error;
      setPatientRecords(data || []);
    } catch (error) {
      console.error('Error fetching patient records:', error);
      toast.error('Failed to load patient records');
    } finally {
      setIsLoadingRecords(false);
    }
  };
  
  const fetchPatientAppointments = async (patientId: string) => {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', patientId)
        .order('appointment_date', { ascending: false });
        
      if (error) throw error;
      setPatientAppointments(data || []);
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      toast.error('Failed to load patient appointments');
    }
  };
  
  const handleViewPatient = async (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab('overview');
    await Promise.all([
      fetchPatientRecords(patient.id),
      fetchPatientAppointments(patient.id)
    ]);
  };
  
  const handleClosePatientView = () => {
    setSelectedPatient(null);
    setPatientRecords([]);
    setPatientAppointments([]);
  };

  if (loading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-200 animate-pulse rounded-lg"></div>)}
          </div>
          <div className="h-96 bg-gray-200 animate-pulse rounded-lg"></div>
        </div>
      </DashboardLayout>
    );
  }

    // Tabs for patient view
  const patientViewTabs = [
    { id: 'all' as const, label: 'All Patients' },
    { id: 'week' as const, label: 'This Week' },
    { id: 'day' as const, label: 'Today' },
  ];

  // Function to format JSON data with syntax highlighting
  const formatJson = (data: unknown): React.ReactNode => {
    try {
      if (!data) return <span className="text-muted-foreground">No data</span>;
      const jsonStr = JSON.stringify(data, null, 2);
      return (
        <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-x-auto">
          <code className="language-json">
            {jsonStr}
          </code>
        </pre>
      );
    } catch (e) {
      return <span className="text-muted-foreground">Invalid data</span>;
    }
  };

  const uniqueUsers = Array.from(new Set(activityLogs.map(log => log.user_id)))
    .filter(Boolean) as string[];

  const actionTypes = Array.from(new Set(activityLogs.map(log => log.action.split('.')[0]))).filter(Boolean) as string[];
  return (
    <DashboardLayout title="Admin Dashboard">
      <div className="space-y-4">
  


        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Overview
            </CardTitle>
            <CardDescription>Key metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Patients" value={stats.totalPatients} icon={Users} color="green" sub="Total registered" />
              <StatCard title="Appointments" value={stats.activeAppointments} icon={CalendarIcon} color="blue" sub="Active now" />
              <StatCard title="Users" value={stats.totalUsers} icon={User} color="purple" sub="Platform users" />
              <StatCard title="Services" value={stats.totalServices} icon={ClipboardList} color="orange" sub="Active services" />
            </div>
          </CardContent>
        </Card>

        {/* System Settings Card */}
        <Card className="shadow-lg border-blue-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  System Settings
                </CardTitle>
                <CardDescription>Configure consultation fees and system preferences</CardDescription>
              </div>
              <Button onClick={() => setShowSettingsDialog(true)} className="gap-2">
                <Edit className="h-4 w-4" />
                Manage Settings
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 border rounded-lg bg-blue-50/50">
                <div className="text-sm text-muted-foreground mb-1">Default Consultation Fee</div>
                <div className="text-2xl font-bold text-blue-600">
                  {systemSettings.currency} {parseFloat(systemSettings.consultation_fee).toLocaleString()}
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-green-50/50">
                <div className="text-sm text-muted-foreground mb-1">Hospital Name</div>
                <div className="text-lg font-semibold text-green-700">
                  {systemSettings.hospital_name}
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-amber-50/50">
                <div className="text-sm text-muted-foreground mb-1">Report Header</div>
                <div className="text-sm font-semibold text-amber-700 line-clamp-2">
                  {systemSettings.report_header || 'Not set'}
                </div>
              </div>
              <div className="p-4 border rounded-lg bg-purple-50/50">
                <div className="text-sm text-muted-foreground mb-1">Department Fees</div>
                <div className="text-lg font-semibold text-purple-700">
                  {Object.keys(departmentFees).length} configured
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>Manage users and roles</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No users found</h3>
                <p className="text-muted-foreground text-sm mt-1">
                  Users will appear here once they are registered in the system.
                </p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Active Role</TableHead>

                      <TableHead className="w-[160px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="font-medium">{u.full_name || u.user_metadata?.full_name || 'Unknown'}</div>
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{u.activeRole || 'No role'}</Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditUser(u)}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleAssignRole(u)}>
                              <Shield className="h-4 w-4" />
                              <span className="sr-only">Assign Role</span>
                            </Button>
                            <Button variant="destructive" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteUser(u.id)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user details</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" value={userForm.full_name} onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} />
              </div>
              <Button type="submit" className="w-full">Save Changes</Button>
            </form>
          </DialogContent>
        </Dialog>

        <ActivityLogsView />

        {/* Billing Analysis */}
        <Card className="shadow-lg border-green-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Billing Overview & Analysis
                </CardTitle>
                <CardDescription>Financial summary and billing statistics</CardDescription>
              </div>
              <Button onClick={() => window.location.href = '/billing'} variant="outline" size="sm">
                <DollarSign className="h-4 w-4 mr-2" />
                View Full Billing
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <BillingAnalysis />
          </CardContent>
        </Card>

        {/* Department Management */}
        <Card className="shadow-lg border-purple-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-purple-600" />
                  Department Management
                </CardTitle>
                <CardDescription>Manage hospital departments</CardDescription>
              </div>
              <Button onClick={handleAddDepartment} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/20">
                <Stethoscope className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium text-muted-foreground">No departments found</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first department to get started</p>
                <Button onClick={handleAddDepartment} variant="outline" size="sm" className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Department
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((dept) => (
                      <TableRow key={dept.id}>
                        <TableCell className="font-medium">{dept.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {dept.description || 'No description'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(dept.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditDepartment(dept)}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteDepartment(dept.id)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Department Dialog */}
        <Dialog open={showDepartmentDialog} onOpenChange={setShowDepartmentDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingDepartment ? 'Edit Department' : 'Add New Department'}
              </DialogTitle>
              <DialogDescription>
                {editingDepartment 
                  ? 'Update the department information below'
                  : 'Create a new department for your hospital'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dept_name">Department Name *</Label>
                <Input
                  id="dept_name"
                  value={departmentForm.name}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })}
                  placeholder="e.g., Cardiology, Pediatrics"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dept_description">Description</Label>
                <Textarea
                  id="dept_description"
                  value={departmentForm.description}
                  onChange={(e) => setDepartmentForm({ ...departmentForm, description: e.target.value })}
                  placeholder="Brief description of the department"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDepartmentDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDepartment}>
                  {editingDepartment ? 'Update' : 'Create'} Department
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Card className="shadow-lg">
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Patients
              </CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search patients…"
                  className="h-8 w-48"
                />
              </div>
            </div>
            <CardDescription>Quickly view and inspect patients</CardDescription>
          </CardHeader>
          <CardContent>
            <PatientView
              patients={patients.filter((p) => {
                const name = (p.full_name || `${p.first_name} ${p.last_name}` || '').toLowerCase();
                const phone = (p.phone || '').toLowerCase();
                const q = searchTerm.toLowerCase();
                return name.includes(q) || phone.includes(q);
              })}
              view={patientView}
              onViewChange={setPatientView}
              loading={loading}
              onViewPatient={handleViewPatient}
              selectedPatient={selectedPatient}
              patientRecords={patientRecords}
              patientAppointments={patientAppointments}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onClosePatientView={handleClosePatientView}
              isLoadingRecords={isLoadingRecords}
            />
          </CardContent>
        </Card>

        {/* Reports Section */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Reports
            </CardTitle>
            <CardDescription>Generate and view system reports</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminReports />
          </CardContent>
        </Card>

        {/* Medical services management moved to Medical Services page */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Role</DialogTitle>
              <DialogDescription>Select a role to assign to this user</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRoleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select name="role" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="nurse">Nurse</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="lab_tech">Lab Technician</SelectItem>
                    <SelectItem value="pharmacist">Pharmacist</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isPrimary" name="isPrimary" />
                <Label 
                  htmlFor="isPrimary" 
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Set as active role (determines login redirect)
                </Label>
              </div>
              <Button type="submit" className="w-full">Assign Role</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Service dialogs and CSV import moved to Medical Services page */}

        {/* Settings Dialog */}
        <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                System Settings
              </DialogTitle>
              <DialogDescription>
                Configure consultation fees and system preferences
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4 overflow-y-auto flex-1 px-6 -mx-6">
              {/* General Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">General Settings</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hospital_name">Hospital/Clinic Name</Label>
                    <Input
                      id="hospital_name"
                      value={systemSettings.hospital_name}
                      onChange={(e) => setSystemSettings({...systemSettings, hospital_name: e.target.value})}
                      placeholder="Enter hospital name"
                    />
                    <p className="text-xs text-muted-foreground">
                      This name will appear on reports, invoices, and system headers
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report_header">Report Header</Label>
                    <Input
                      id="report_header"
                      value={systemSettings.report_header}
                      onChange={(e) => setSystemSettings({...systemSettings, report_header: e.target.value})}
                      placeholder="Enter report header text"
                    />
                    <p className="text-xs text-muted-foreground">
                      Custom header text for printed reports and documents
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select 
                      value={systemSettings.currency} 
                      onValueChange={(value) => setSystemSettings({...systemSettings, currency: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TSh">TSh (Tanzanian Shilling)</SelectItem>
                        <SelectItem value="USD">USD (US Dollar)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
                        <SelectItem value="UGX">UGX (Ugandan Shilling)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Default Consultation Fee */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Default Consultation Fee</h3>
                <div className="space-y-2">
                  <Label htmlFor="consultation_fee">Default Fee Amount</Label>
                  <div className="flex gap-2 items-center">
                    <span className="text-sm font-medium">{systemSettings.currency}</span>
                    <Input
                      id="consultation_fee"
                      type="number"
                      step="1000"
                      value={systemSettings.consultation_fee}
                      onChange={(e) => setSystemSettings({...systemSettings, consultation_fee: e.target.value})}
                      placeholder="50000"
                      className="flex-1"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This is the default consultation fee when no department-specific fee is set
                  </p>
                </div>
              </div>

              {/* Department-Specific Fees */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      Department-Specific Consultation Fees
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Set custom fees per department - these override the default fee
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {departments.length} departments
                  </Badge>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    <strong>How it works:</strong> Enter a fee amount for each department. Leave blank to use the default fee ({systemSettings.currency} {systemSettings.consultation_fee}). These fees will be automatically applied when booking appointments.
                  </p>
                </div>
                
                {departments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
                    <Stethoscope className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">No departments found</p>
                    <p className="text-xs mt-1">Create departments first to set department-specific fees</p>
                  </div>
                ) : (
                  <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg">
                        <div className="text-xs text-blue-600 font-medium">Total Departments</div>
                        <div className="text-2xl font-bold text-blue-700">{departments.length}</div>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg">
                        <div className="text-xs text-green-600 font-medium">Custom Fees Set</div>
                        <div className="text-2xl font-bold text-green-700">
                          {Object.keys(departmentFees).filter(k => departmentFees[k]).length}
                        </div>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-lg">
                        <div className="text-xs text-amber-600 font-medium">Using Default</div>
                        <div className="text-2xl font-bold text-amber-700">
                          {departments.length - Object.keys(departmentFees).filter(k => departmentFees[k]).length}
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto border-2 rounded-lg p-4 bg-gradient-to-br from-gray-50 to-gray-100">
                    {departments.map((dept) => (
                      <div key={dept.id} className="flex items-center gap-4 p-4 border-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900">{dept.name}</div>
                          {dept.description && (
                            <div className="text-xs text-muted-foreground mt-1">{dept.description}</div>
                          )}
                          {departmentFees[dept.id] && (
                            <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-300">
                              Custom fee set
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 min-w-[220px]">
                          <span className="text-sm font-semibold text-gray-700">{systemSettings.currency}</span>
                          <Input
                            type="number"
                            step="1000"
                            value={departmentFees[dept.id] || ''}
                            onChange={(e) => setDepartmentFees({
                              ...departmentFees,
                              [dept.id]: e.target.value
                            })}
                            placeholder={`Default: ${systemSettings.consultation_fee}`}
                            className="w-32 font-medium"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  </>
                )}
              </div>

              {/* Enable/Disable Features */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Feature Toggles</h3>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">Enable Department-Specific Fees</div>
                    <div className="text-xs text-muted-foreground">
                      When enabled, appointments will use department-specific fees instead of the default
                    </div>
                  </div>
                  <Checkbox
                    checked={systemSettings.enable_appointment_fees === 'true'}
                    onCheckedChange={(checked) => 
                      setSystemSettings({
                        ...systemSettings, 
                        enable_appointment_fees: checked ? 'true' : 'false'
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white z-10 -mx-6 px-6 pb-2">
              <Button 
                variant="outline" 
                onClick={() => setShowSettingsDialog(false)}
                disabled={savingSettings}
              >
                Cancel
              </Button>
              <Button 
                onClick={saveSettings}
                disabled={savingSettings}
                className="min-w-32"
              >
                {savingSettings ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
