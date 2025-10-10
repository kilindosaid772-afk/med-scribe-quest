import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Calendar as CalendarIcon } from 'lucide-react';

interface EnhancedAppointmentBookingProps {
  patients: any[];
  onSuccess: () => void;
}

export const EnhancedAppointmentBooking = ({ patients, onSuccess }: EnhancedAppointmentBookingProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<any[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  useEffect(() => {
    if (dialogOpen) {
      fetchDepartments();
      fetchDoctors();
    }
  }, [dialogOpen]);

  useEffect(() => {
    if (selectedDepartment) {
      // In a real system, you'd filter doctors by department
      // For now, we'll show all doctors
      setFilteredDoctors(doctors);
    } else {
      setFilteredDoctors(doctors);
    }
  }, [selectedDepartment, doctors]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').order('name');
    setDepartments(data || []);
  };

  const fetchDoctors = async () => {
    // Fetch all users with doctor role
    const { data: doctorRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'doctor');

    if (doctorRoles && doctorRoles.length > 0) {
      const doctorIds = doctorRoles.map(r => r.user_id);
      const { data: doctorProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', doctorIds);

      setDoctors(doctorProfiles || []);
      setFilteredDoctors(doctorProfiles || []);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const appointmentData = {
      patient_id: formData.get('patientId') as string,
      doctor_id: formData.get('doctorId') as string,
      department_id: formData.get('departmentId') as string || null,
      appointment_date: formData.get('appointmentDate') as string,
      appointment_time: formData.get('appointmentTime') as string,
      reason: formData.get('reason') as string,
      notes: formData.get('notes') as string,
      status: 'Scheduled',
    };

    const { error } = await supabase.from('appointments').insert([appointmentData]);

    if (error) {
      toast.error('Failed to book appointment');
    } else {
      // Create patient visit record to track workflow
      const visitData = {
        patient_id: appointmentData.patient_id,
        appointment_id: null, // Will be updated when we have the appointment ID
        visit_date: appointmentData.appointment_date,
        current_stage: 'reception',
        overall_status: 'Active',
        reception_status: 'Pending',
        reception_notes: `Appointment scheduled for ${appointmentData.appointment_date} at ${appointmentData.appointment_time}`,
      };

      const { data: visit, error: visitError } = await supabase
        .from('patient_visits')
        .insert([visitData])
        .select()
        .single();

      if (visitError) {
        console.error('Failed to create patient visit:', visitError);
        toast.error('Appointment booked but failed to create visit record');
      } else {
        toast.success('Appointment booked successfully');
      }

      setDialogOpen(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button>
          <CalendarIcon className="mr-2 h-4 w-4" />
          Book Appointment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book New Appointment</DialogTitle>
          <DialogDescription>Schedule an appointment for a patient</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleBookAppointment} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patientId">Patient</Label>
            <Select name="patientId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="departmentId">Department</Label>
            <Select
              name="departmentId"
              onValueChange={(value) => setSelectedDepartment(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doctorId">Doctor</Label>
            <Select name="doctorId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {filteredDoctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    {doctor.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">Appointment Date</Label>
              <Input
                id="appointmentDate"
                name="appointmentDate"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appointmentTime">Appointment Time</Label>
              <Input
                id="appointmentTime"
                name="appointmentTime"
                type="time"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Visit</Label>
            <Textarea
              id="reason"
              name="reason"
              placeholder="Describe the reason for the appointment"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Any special instructions or notes"
            />
          </div>

          <Button type="submit" className="w-full">Book Appointment</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
