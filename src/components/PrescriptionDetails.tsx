import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PrescriptionDetailsProps {
  prescription: {
    prescription_id: string;
    patient_id: string;
    medication_id: string;
    quantity: number;
  };
}

export function PrescriptionDetails({ prescription }: PrescriptionDetailsProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl font-semibold">Prescription Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Prescription ID</p>
            <p className="font-mono text-sm">{prescription.prescription_id}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Quantity</p>
            <Badge variant="outline" className="text-sm">
              {prescription.quantity} {prescription.quantity === 1 ? 'unit' : 'units'}
            </Badge>
          </div>
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Patient ID</p>
          <p className="font-mono text-sm">{prescription.patient_id}</p>
        </div>
        
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Medication ID</p>
          <p className="font-mono text-sm">{prescription.medication_id}</p>
        </div>
      </CardContent>
    </Card>
  );
}
