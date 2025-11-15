import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface DispenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prescription: any;
  medication: any;
  onDispense: (data: any) => void;
  loading?: boolean;
}

export function DispenseDialog({ 
  open, 
  onOpenChange, 
  prescription, 
  medication,
  onDispense,
  loading = false
}: DispenseDialogProps) {
  
  const [dispenseForm, setDispenseForm] = useState({
    dosage: prescription?.dosage || '',
    quantity: prescription?.quantity || 0,
    pharmacist_notes: ''
  });

  const totalCost = medication && dispenseForm.quantity 
    ? (medication.unit_price || 0) * (dispenseForm.quantity || 0)
    : 0;

  const handleSubmit = () => {
    onDispense(dispenseForm);
  };

  const isLowStock = medication && medication.quantity_in_stock < prescription?.quantity;
  const isOutOfStock = medication && medication.quantity_in_stock === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dispense Medication</DialogTitle>
          <DialogDescription>
            Review and confirm medication details before dispensing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient & Medication Info */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold mb-2">Patient Information</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Patient:</span>
                <span className="ml-2 font-medium">{prescription?.patient?.full_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Medication:</span>
                <span className="ml-2 font-medium">{medication?.name}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Unit Price:</span>
                <span className="ml-2 font-medium">TSh {(medication?.unit_price || 0).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Editable Dispensing Details */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-semibold">Dispensing Details (Editable)</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dosage">Dosage *</Label>
                <Input
                  id="dosage"
                  value={dispenseForm.dosage}
                  onChange={(e) => setDispenseForm({...dispenseForm, dosage: e.target.value})}
                  placeholder="e.g., 500mg, 2 tablets"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Prescribed: {prescription?.dosage}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity to Dispense *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={dispenseForm.quantity}
                  onChange={(e) => setDispenseForm({...dispenseForm, quantity: parseInt(e.target.value) || 0})}
                  placeholder="Enter quantity"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Prescribed: {prescription?.quantity}
                </p>
              </div>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Cost:</span>
                <span className="text-xl font-bold text-green-700">
                  TSh {totalCost.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {dispenseForm.quantity} × TSh {(medication?.unit_price || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pharmacist_notes">Pharmacist Notes</Label>
            <Textarea
              id="pharmacist_notes"
              value={dispenseForm.pharmacist_notes}
              onChange={(e) => setDispenseForm({...dispenseForm, pharmacist_notes: e.target.value})}
              placeholder="Any additional notes or warnings for the patient"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || !dispenseForm.dosage || !dispenseForm.quantity}
            >
              {loading ? 'Processing...' : 'Dispense Medication'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
