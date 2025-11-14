import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar, FileText, Printer, Download, Settings } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type DateFilter = 'today' | 'week' | 'month' | 'all';

export default function AdminReports() {
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [reportData, setReportData] = useState<any>({
    patients: [],
    appointments: [],
    visits: [],
    prescriptions: [],
    labTests: []
  });
  const [stats, setStats] = useState({
    totalPatients: 0,
    totalAppointments: 0,
    totalVisits: 0,
    totalPrescriptions: 0,
    totalLabTests: 0
  });
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    hospitalName: 'Medical Center',
    reportHeader: 'Healthcare Management System Report',
    consultationFee: 2000,
    includePatientDetails: true,
    includeAppointments: true,
    includeVisits: true,
    includePrescriptions: true,
    includeLabTests: true
  });

  useEffect(() => {
    fetchReportData();
    fetchSystemSettings();
  }, [dateFilter]);

  const fetchSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (!error && data) {
        const consultationFeeSetting = data.find(s => s.key === 'consultation_fee');
        if (consultationFeeSetting) {
          setSettings(prev => ({ ...prev, consultationFee: Number(consultationFeeSetting.value) }));
        }
      }
    } catch (error) {
      console.log('Using default settings');
    }
  };

  const saveConsultationFee = async () => {
    try {
      // First check if the setting exists
      const { data: existing } = await supabase
        .from('system_settings')
        .select('*')
        .eq('key', 'consultation_fee')
        .single();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('system_settings')
          .update({
            value: settings.consultationFee.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('key', 'consultation_fee');

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('system_settings')
          .insert({
            key: 'consultation_fee',
            value: settings.consultationFee.toString(),
            description: 'Consultation fee charged at reception',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (error) throw error;
      }

      toast.success('Consultation fee updated successfully');
      setSettingsOpen(false);
    } catch (error: any) {
      console.error('Error saving consultation fee:', error);
      toast.error(`Failed to update consultation fee: ${error.message}`);
    }
  };

  const getDateRange = () => {
    const now = new Date();
    
    switch (dateFilter) {
      case 'today':
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
      case 'week':
        return {
          start: startOfWeek(now),
          end: endOfWeek(now)
        };
      case 'month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now)
        };
      case 'all':
        return {
          start: new Date('2000-01-01'),
          end: now
        };
      default:
        return {
          start: startOfDay(now),
          end: endOfDay(now)
        };
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      // Fetch patients
      const { data: patientsData } = await supabase
        .from('patients')
        .select('*')
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false });

      // Fetch appointments
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(full_name, phone),
          doctor:users(full_name)
        `)
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('appointment_date', { ascending: false });

      // Fetch visits
      const { data: visitsData } = await supabase
        .from('patient_visits')
        .select(`
          *,
          patient:patients(full_name, phone)
        `)
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false });

      // Fetch prescriptions
      const { data: prescriptionsData } = await supabase
        .from('prescriptions')
        .select(`
          *,
          patient:patients(full_name, phone)
        `)
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('created_at', { ascending: false });

      // Fetch lab tests
      const { data: labTestsData } = await supabase
        .from('lab_tests')
        .select(`
          *,
          patient:patients(full_name, phone)
        `)
        .gte('created_at', startStr)
        .lte('created_at', endStr)
        .order('ordered_date', { ascending: false });

      setReportData({
        patients: patientsData || [],
        appointments: appointmentsData || [],
        visits: visitsData || [],
        prescriptions: prescriptionsData || [],
        labTests: labTestsData || []
      });

      setStats({
        totalPatients: patientsData?.length || 0,
        totalAppointments: appointmentsData?.length || 0,
        totalVisits: visitsData?.length || 0,
        totalPrescriptions: prescriptionsData?.length || 0,
        totalLabTests: labTestsData?.length || 0
      });

    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const csvContent = generateCSV();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${dateFilter}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  const generateCSV = () => {
    let csv = `${settings.reportHeader}\n`;
    csv += `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}\n`;
    csv += `Period: ${dateFilter.toUpperCase()}\n\n`;

    // Summary
    csv += 'SUMMARY\n';
    csv += `Total Patients,${stats.totalPatients}\n`;
    csv += `Total Appointments,${stats.totalAppointments}\n`;
    csv += `Total Visits,${stats.totalVisits}\n`;
    csv += `Total Prescriptions,${stats.totalPrescriptions}\n`;
    csv += `Total Lab Tests,${stats.totalLabTests}\n\n`;

    // Patients
    if (settings.includePatientDetails && reportData.patients.length > 0) {
      csv += 'PATIENTS\n';
      csv += 'Name,Phone,Gender,Blood Group,Date of Birth,Status\n';
      reportData.patients.forEach((p: any) => {
        csv += `${p.full_name},${p.phone},${p.gender},${p.blood_group || 'N/A'},${p.date_of_birth},${p.status}\n`;
      });
      csv += '\n';
    }

    // Appointments
    if (settings.includeAppointments && reportData.appointments.length > 0) {
      csv += 'APPOINTMENTS\n';
      csv += 'Patient,Doctor,Date,Time,Status,Reason\n';
      reportData.appointments.forEach((a: any) => {
        csv += `${a.patient?.full_name || 'N/A'},${a.doctor?.full_name || 'N/A'},${a.appointment_date},${a.appointment_time},${a.status},${a.reason || 'N/A'}\n`;
      });
      csv += '\n';
    }

    return csv;
  };

  const getFilterLabel = () => {
    switch (dateFilter) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'all': return 'All Time';
      default: return 'Today';
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-20 bg-gray-200 animate-pulse rounded-lg"></div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 animate-pulse rounded-lg"></div>)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 print:space-y-4">
      {/* Header - Hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-2xl font-bold">Admin Reports</h2>
          <p className="text-muted-foreground">Generate and export system reports</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report Settings</DialogTitle>
                <DialogDescription>Configure report preferences</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="hospitalName">Hospital Name</Label>
                  <Input
                    id="hospitalName"
                    value={settings.hospitalName}
                    onChange={(e) => setSettings({...settings, hospitalName: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="reportHeader">Report Header</Label>
                  <Input
                    id="reportHeader"
                    value={settings.reportHeader}
                    onChange={(e) => setSettings({...settings, reportHeader: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="consultationFee">Consultation Fee (TSh)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="consultationFee"
                      type="number"
                      value={settings.consultationFee}
                      onChange={(e) => setSettings({...settings, consultationFee: Number(e.target.value)})}
                    />
                    <Button onClick={saveConsultationFee} size="sm">
                      Save
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    This fee will be collected at reception before patient check-in
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Include in Report</Label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.includePatientDetails}
                        onChange={(e) => setSettings({...settings, includePatientDetails: e.target.checked})}
                      />
                      <span>Patient Details</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.includeAppointments}
                        onChange={(e) => setSettings({...settings, includeAppointments: e.target.checked})}
                      />
                      <span>Appointments</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.includeVisits}
                        onChange={(e) => setSettings({...settings, includeVisits: e.target.checked})}
                      />
                      <span>Patient Visits</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.includePrescriptions}
                        onChange={(e) => setSettings({...settings, includePrescriptions: e.target.checked})}
                      />
                      <span>Prescriptions</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.includeLabTests}
                        onChange={(e) => setSettings({...settings, includeLabTests: e.target.checked})}
                      />
                      <span>Lab Tests</span>
                    </label>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Select value={dateFilter} onValueChange={(value: DateFilter) => setDateFilter(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Print Header - Only visible on print */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">{settings.hospitalName}</h1>
        <h2 className="text-xl">{settings.reportHeader}</h2>
        <p className="text-sm text-gray-600">
          Period: {getFilterLabel()} | Generated: {format(new Date(), 'MMM dd, yyyy HH:mm')}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5 print:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Patients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPatients}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAppointments}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Visits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVisits}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Prescriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPrescriptions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Lab Tests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLabTests}</div>
          </CardContent>
        </Card>
      </div>

      {/* Patients Table */}
      {settings.includePatientDetails && reportData.patients.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Patients ({stats.totalPatients})</CardTitle>
            <CardDescription>Patient registrations for {getFilterLabel().toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Blood Group</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.patients.map((patient: any) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.full_name}</TableCell>
                    <TableCell>{patient.phone}</TableCell>
                    <TableCell>{patient.gender}</TableCell>
                    <TableCell>{patient.blood_group || 'N/A'}</TableCell>
                    <TableCell>{format(new Date(patient.date_of_birth), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Appointments Table */}
      {settings.includeAppointments && reportData.appointments.length > 0 && (
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle>Appointments ({stats.totalAppointments})</CardTitle>
            <CardDescription>Scheduled appointments for {getFilterLabel().toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.appointments.map((appointment: any) => (
                  <TableRow key={appointment.id}>
                    <TableCell>{appointment.patient?.full_name || 'N/A'}</TableCell>
                    <TableCell>{appointment.doctor?.full_name || 'N/A'}</TableCell>
                    <TableCell>{format(new Date(appointment.appointment_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{appointment.appointment_time}</TableCell>
                    <TableCell>
                      <Badge variant={
                        appointment.status === 'Completed' ? 'default' :
                        appointment.status === 'Scheduled' ? 'secondary' :
                        'outline'
                      }>
                        {appointment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{appointment.reason || 'N/A'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Visits Table */}
      {settings.includeVisits && reportData.visits.length > 0 && (
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle>Patient Visits ({stats.totalVisits})</CardTitle>
            <CardDescription>Patient visits for {getFilterLabel().toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Visit Date</TableHead>
                  <TableHead>Current Stage</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.visits.map((visit: any) => (
                  <TableRow key={visit.id}>
                    <TableCell>{visit.patient?.full_name || 'N/A'}</TableCell>
                    <TableCell>{format(new Date(visit.visit_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell className="capitalize">{visit.current_stage}</TableCell>
                    <TableCell>
                      <Badge variant={visit.overall_status === 'Active' ? 'default' : 'secondary'}>
                        {visit.overall_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Lab Tests Table */}
      {settings.includeLabTests && reportData.labTests.length > 0 && (
        <Card className="print:break-inside-avoid">
          <CardHeader>
            <CardTitle>Lab Tests ({stats.totalLabTests})</CardTitle>
            <CardDescription>Laboratory tests for {getFilterLabel().toLowerCase()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Ordered Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.labTests.map((test: any) => (
                  <TableRow key={test.id}>
                    <TableCell>{test.patient?.full_name || 'N/A'}</TableCell>
                    <TableCell>{test.test_name}</TableCell>
                    <TableCell>{test.test_type}</TableCell>
                    <TableCell>
                      <Badge variant={
                        test.priority === 'STAT' ? 'destructive' :
                        test.priority === 'Urgent' ? 'default' :
                        'secondary'
                      }>
                        {test.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(test.ordered_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={test.status === 'Completed' ? 'default' : 'secondary'}>
                        {test.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
}
