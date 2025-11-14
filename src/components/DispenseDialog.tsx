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
  
  const totalCost = medication && prescription 
    ? (medication.unit_price || 0) * (prescription.quantity || 0)
    : 0;
  const [dispenseForm, setDispenseForm] = useState({
    actual_dosage: prescription?.dosage || '',
    dosage_mg: '',
    quantity_dispensed: prescription?.quantity || 0,
    in_stock: true,
    out_of_stock_reason: '',
    alternative_medication: '',
    pharmacist_notes: ''
  });

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
          {/* Prescription Info */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold mb-2">Prescription Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Patient:</span>
                <span className="ml-2 font-medium">{prescription?.patient?.full_name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Medication:</span>
                <span className="ml-2 font-medium">{medication?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Prescribed Dosage:</span>
                <span className="ml-2 font-medium">{prescription?.dosage}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Quantity Prescribed:</span>
                <span className="ml-2 font-medium">{prescription?.quantity}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Unit Price:</span>
                <span className="ml-2 font-medium">TSh {(medication?.unit_price || 0).toLocaleString()}</span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Total Cost:</span>
                <span className="ml-2 font-bold text-lg text-blue-600">TSh {totalCost.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Stock Status */}
          <div className={`p-4 rounded-lg border ${
            isOutOfStock ? 'bg-red-50 border-red-200' :
            isLowStock ? 'bg-yellow-50 border-yellow-200' :
            'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {isOutOfStock || isLowStock ? (
                <AlertTriangle className={`h-5 w-5 ${isOutOfStock ? 'text-red-600' : 'text-yellow-600'}`} />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              <h4 className="font-semibold">
                {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock Warning' : 'Stock Available'}
              </h4>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Current Stock:</span>
              <span className="ml-2 font-bold">{medication?.quantity_in_stock || 0} units</span>
              {isLowStock && !isOutOfStock && (
                <span className="ml-2 text-yellow-700">
                  (Only {medication?.quantity_in_stock} available, {prescription?.quantity} requested)
                </span>
              )}
            </div>
          </div>

          {/* Dosage Verification */}
          <div className="space-y-2">
            <Label htmlFor="actual_dosage">Actual Dosage Instructions *</Label>
            <Textarea
              id="actual_dosage"
              value={dispenseForm.actual_dosage}
              onChange={(e) => setDispenseForm({...dispenseForm, actual_dosage: e.target.value})}
              placeholder="e.g., Take 1 tablet twice daily after meals"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Verify and correct if doctor's prescription has errors
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dosage_mg">Dosage Strength (mg) *</Label>
              <Input
                id="dosage_mg"
                type="number"
                value={dispenseForm.dosage_mg}
                onChange={(e) => setDispenseForm({...dispenseForm, dosage_mg: e.target.value})}
                placeholder="e.g., 500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_dispensed">Quantity to Dispense *</Label>
              <Input
                id="quantity_dispensed"
                type="number"
                value={dispenseForm.quantity_dispensed}
                onChange={(e) => setDispenseForm({...dispenseForm, quantity_dispensed: Number(e.target.value)})}
                max={medication?.quantity_in_stock || 0}
              />
            </div>
          </div>

          {/* Stock Status Selection */}
          <div className="space-y-2">
            <Label htmlFor="in_stock">Stock Status *</Label>
            <Select
              value={dispenseForm.in_stock ? 'true' : 'false'}
              onValueChange={(value) => setDispenseForm({...dispenseForm, in_stock: value === 'true'})}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">In Stock - Can Dispense</SelectItem>
                <SelectItem value="false">Out of Stock / Not Available</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!dispenseForm.in_stock && (
            <>
              <div className="space-y-2">
                <Label htmlFor="out_of_stock_reason">Reason for Non-Availability *</Label>
                <Textarea
                  id="out_of_stock_reason"
                  value={dispenseForm.out_of_stock_reason}
                  onChange={(e) => setDispenseForm({...dispenseForm, out_of_stock_reason: e.target.value})}
                  placeholder="Explain why medication cannot be dispensed"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alternative_medication">Alternative Medication (if any)</Label>
                <Input
                  id="alternative_medication"
                  value={dispenseForm.alternative_medication}
                  onChange={(e) => setDispenseForm({...dispenseForm, alternative_medication: e.target.value})}
                  placeholder="Suggest alternative medication"
                />
              </div>
            </>
          )}

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
              disabled={loading || !dispenseForm.actual_dosage || !dispenseForm.dosage_mg}
            >
              {loading ? 'Processing...' : dispenseForm.in_stock ? 'Dispense Medication' : 'Mark as Unavailable'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
