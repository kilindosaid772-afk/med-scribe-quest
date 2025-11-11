import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { supabaseAdmin } from '@/integrations/supabase/admin';
import { toast } from 'sonner';
import { logActivity } from '@/lib/utils';
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
          {(['all', 'week', 'day'] as const).map((tab) => (
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
  const [loading, setLoading] = useState(true);
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
  const [patientView, setPatientView] = useState<'day' | 'week' | 'all'>('all');

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
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone')
        .limit(20);

      // Fetch user roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('id, user_id, role, is_primary');

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
      fetchData();
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
      
      // Refresh the users list
      await fetchData();
      
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
              is_primary: isPrimary,
              updated_at: new Date().toISOString()
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
      fetchData();
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
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>Manage users and roles</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Active Role</TableHead>
                    <TableHead>Roles</TableHead>
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
                      <TableCell>{u.roles?.length || 0}</TableCell>
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

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Activity Logs
            </CardTitle>
            <CardDescription>Recent system activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{format(new Date(log.created_at), 'MMM d, HH:mm')}</TableCell>
                      <TableCell>{log.user_email || 'System'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {JSON.stringify(log.details).slice(0, 60)}{JSON.stringify(log.details).length > 60 ? '…' : ''}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="ml-2 h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="max-w-md">
                            {formatJson(log.details)}
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </DashboardLayout>
  );
}
