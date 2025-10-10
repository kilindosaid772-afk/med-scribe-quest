import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

interface PatientsCardProps {
  patients: any[];
}

export function PatientsCard({ patients }: PatientsCardProps) {
  const recentPatients = patients.slice(0, 5); // Show only the 5 most recent patients

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Recent Patients ({patients.length})
        </CardTitle>
        <CardDescription>Recently registered patients</CardDescription>
      </CardHeader>
      <CardContent>
        {recentPatients.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No patients found</p>
        ) : (
          <div className="space-y-3">
            {recentPatients.map((patient) => (
              <div key={patient.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">{patient.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {patient.phone} • DOB: {format(new Date(patient.date_of_birth), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
                <Badge variant={patient.status === 'Active' ? 'default' : 'secondary'}>
                  {patient.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
