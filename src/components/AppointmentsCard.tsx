import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, XCircle } from 'lucide-react';

interface AppointmentsCardProps {
  appointments: any[];
  onCheckIn: (appointmentId: string) => void;
  onCancel: (appointmentId: string) => void;
}

export function AppointmentsCard({ appointments, onCheckIn, onCancel }: AppointmentsCardProps) {
  // Filter for today's appointments only (in case we have future appointments)
  const todayAppointments = appointments.filter(
    a => a.appointment_date === new Date().toISOString().split('T')[0]
  );

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Today's Appointments ({todayAppointments.length})
        </CardTitle>
        <CardDescription>Manage today's patient schedule</CardDescription>
      </CardHeader>
      <CardContent>
        {todayAppointments.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No appointments scheduled for today</p>
        ) : (
          <div className="space-y-3">
            {todayAppointments.slice(0, 6).map((appointment) => (
              <div key={appointment.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <p className="font-medium">
                      {appointment.patient?.full_name || 'Unknown Patient'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.appointment_time} • Dr. {appointment.doctor?.full_name || 'Unknown Doctor'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appointment.department?.name || 'No Department'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    appointment.status === 'Confirmed' ? 'default' :
                    appointment.status === 'Scheduled' ? 'secondary' : 'outline'
                  }>
                    {appointment.status}
                  </Badge>
                  {appointment.status === 'Scheduled' && (
                    <Button
                      size="sm"
                      onClick={() => onCheckIn(appointment.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Check In
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onCancel(appointment.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
