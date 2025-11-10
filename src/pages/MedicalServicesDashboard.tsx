import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Stethoscope, DollarSign, Loader2, Trash2, Pencil, Check, X } from 'lucide-react';
import { 
  createMedicalService, 
  getMedicalServices, 
  updateMedicalService, 
  deleteMedicalService,
  toggleServiceStatus,
  type MedicalService 
} from '@/services/medicalService';

const SERVICE_TYPES = [
  'Consultation',
  'Procedure',
  'Test',
  'Therapy',
  'Surgery',
  'Other'
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS'];

interface PatientService {
  id: string;
  patient_id: string;
  service_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  service_date: string;
  status: string;
  service?: MedicalService;
}

export default function MedicalServicesDashboard() {
  const { user, hasRole } = useAuth();
  const [services, setServices] = useState<MedicalService[]>([]);
  const [patientServices, setPatientServices] = useState<PatientService[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [newService, setNewService] = useState({
    service_code: '',
    service_name: '',
    service_type: '',
    description: '',
    base_price: 0,
    currency: 'TSh'
  });

  const serviceTypes = [
    'Consultation',
    'Procedure',
    'Surgery',
    'Emergency',
    'Ward Stay',
    'Other'
  ];

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

  const downloadServicesTemplate = () => {
    const headers = ['service_code','service_name','service_type','description','base_price','currency','is_active'];
    const sample = [
      'CONS-0001,General Consultation,Consultation,Initial consultation,50000,TSh,true',
      'PROC-0001,ECG,Procedure,Electrocardiogram,30000,TSh,true'
    ];
    const csv = [headers.join(','), ...sample].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'medical_services_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch medical services
      const { data: servicesData, error: servicesError } = await supabase
        .from('medical_services')
        .select('*')
        .order('service_name');

      if (servicesError) throw servicesError;

      // Fetch patient services
      const { data: patientServicesData, error: patientServicesError } = await supabase
        .from('patient_services')
        .select(`
          *,
          service:medical_services(*)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (patientServicesError) throw patientServicesError;

      // Fetch patients for assignment
      const { data: patientsData, error: patientsError } = await supabase
        .from('patients')
        .select('*')
        .eq('status', 'Active')
        .order('full_name');

      if (patientsError) throw patientsError;

      setServices(servicesData || []);
      setPatientServices(patientServicesData || []);
      setPatients(patientsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load medical services data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!newService.service_code || !newService.service_name || !newService.service_type || !newService.base_price) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('medical_services')
        .insert({
          ...newService,
          is_active: true
        });

      if (error) throw error;

      toast.success('Medical service added successfully!');
      logActivity('service.add', { service_code: newService.service_code, service_name: newService.service_name });
      setShowAddDialog(false);
      setNewService({
        service_code: '',
        service_name: '',
        service_type: '',
        description: '',
        base_price: 0,
        currency: 'TSh'
      });
      fetchData();
    } catch (error) {
      console.error('Error adding service:', error);
      toast.error('Failed to add medical service');
    }
  };

  // Removed assign-to-patient flow from this page per requirements

  const generateServiceCode = () => {
    const type = newService.service_type;
    const prefix = type === 'Consultation' ? 'CONS' :
                   type === 'Procedure' ? 'PROC' :
                   type === 'Surgery' ? 'SURG' :
                   type === 'Emergency' ? 'EMER' :
                   type === 'Ward Stay' ? 'WARD' : 'OTHER';
    const code = `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    setNewService(prev => ({ ...prev, service_code: code }));
  };

  // Only allow medical staff to access this
  if (!user || !hasRole('doctor') && !hasRole('nurse') && !hasRole('admin')) {
    return (
      <DashboardLayout title="Medical Services">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Stethoscope className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-muted-foreground">Only medical staff can access this page.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout title="Medical Services">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Medical Services Management">
      <div className="space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Medical Services</h1>
            <p className="text-muted-foreground">Manage medical problems, tests, and their pricing</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add New Service
            </Button>
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>Import CSV</Button>
            <Button variant="ghost" onClick={downloadServicesTemplate}>Download Template</Button>
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-500" />
                Available Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{services.length}</div>
              <p className="text-sm text-muted-foreground">Total services in catalog</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                Avg Service Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                TSh{(services.reduce((sum, s) => sum + s.base_price, 0) / Math.max(services.length, 1)).toFixed(0)}
              </div>
              <p className="text-sm text-muted-foreground">Average price per service</p>
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-purple-500" />
                Services Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {patientServices.filter(ps => ps.service_date === new Date().toISOString().split('T')[0]).length}
              </div>
              <p className="text-sm text-muted-foreground">Services provided today</p>
            </CardContent>
          </Card>
        </div>

        {/* Services Table */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Medical Services Catalog</CardTitle>
            <CardDescription>All available medical services and their pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Code</TableHead>
                    <TableHead>Service Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-mono text-sm">{service.service_code}</TableCell>
                      <TableCell className="font-medium">{service.service_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{service.service_type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {service.description || 'No description'}
                      </TableCell>
                      <TableCell className="font-semibold">
                        TSh{service.base_price.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.is_active ? 'default' : 'secondary'}>
                          {service.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Patient Services */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Recent Patient Services</CardTitle>
            <CardDescription>Services provided to patients recently</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientServices.slice(0, 10).map((ps) => (
                    <TableRow key={ps.id}>
                      <TableCell className="font-medium">
                        {/* Find patient name - this would need a join in real implementation */}
                        Patient ID: {ps.patient_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{ps.service?.service_name || 'Unknown Service'}</TableCell>
                      <TableCell>{ps.quantity}</TableCell>
                      <TableCell>TSh{ps.unit_price.toLocaleString()}</TableCell>
                      <TableCell className="font-semibold">TSh{ps.total_price.toLocaleString()}</TableCell>
                      <TableCell>{new Date(ps.service_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={ps.status === 'Completed' ? 'default' : 'secondary'}>
                          {ps.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add Service Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Medical Service</DialogTitle>
              <DialogDescription>Add a new medical problem, test, or service with pricing</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="service_type">Service Type *</Label>
                  <Select
                    value={newService.service_type}
                    onValueChange={(value) => {
                      setNewService(prev => ({ ...prev, service_type: value }));
                      setTimeout(generateServiceCode, 100);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service_code">Service Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="service_code"
                      value={newService.service_code}
                      onChange={(e) => setNewService(prev => ({ ...prev, service_code: e.target.value }))}
                      placeholder="CONS-001"
                    />
                    <Button type="button" variant="outline" size="sm" onClick={generateServiceCode}>
                      Auto
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="service_name">Service Name *</Label>
                <Input
                  id="service_name"
                  value={newService.service_name}
                  onChange={(e) => setNewService(prev => ({ ...prev, service_name: e.target.value }))}
                  placeholder="General Consultation"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newService.description}
                  onChange={(e) => setNewService(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the service"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_price">Base Price (TSh) *</Label>
                <Input
                  id="base_price"
                  type="number"
                  value={newService.base_price}
                  onChange={(e) => setNewService(prev => ({ ...prev, base_price: parseFloat(e.target.value) || 0 }))}
                  placeholder="50000"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddService}>
                  Add Service
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Services Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={(open) => {
          setImportDialogOpen(open);
          if (!open) {
            setImportFile(null);
            setImportPreview([]);
            setImportError(null);
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Medical Services (CSV)</DialogTitle>
              <DialogDescription>
                Upload a CSV file with columns: service_code, service_name, service_type, description, base_price, currency, is_active
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Input type="file" accept=".csv" onChange={async (e) => {
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
                }} />
                <Button type="button" variant="ghost" onClick={downloadServicesTemplate}>
                  Download Template
                </Button>
              </div>
              {importError && (
                <div className="text-sm text-red-600">{importError}</div>
              )}
              {importPreview.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <div className="px-3 py-2 text-sm font-medium bg-muted">Preview (first 10 rows)</div>
                  <div className="max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Price</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreview.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{row.service_code}</TableCell>
                            <TableCell className="text-sm">{row.service_name}</TableCell>
                            <TableCell><Badge variant="outline">{row.service_type}</Badge></TableCell>
                            <TableCell className="font-semibold">TSh{Number(row.base_price || 0).toLocaleString()}</TableCell>
                            <TableCell>
                              <Badge variant={row.is_active ? 'default' : 'secondary'}>
                                {row.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
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
                    logActivity('service.import', { count: rows.length });
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
                }} disabled={importing || !importFile}>
                  {importing ? 'Importing…' : 'Import Services'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
