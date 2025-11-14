import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Pill, Plus, Trash2, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Medication {
  id: string;
  name: string;
  strength: string;
  unit_price: number;
  quantity_in_stock: number;
}

interface PrescriptionItem {
  medication_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string;
  unit_price: number;
  include_in_billing: boolean;
}

interface EnhancedPrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: any[];
  onSuccess: () => void;
  userId: string;
}

export function EnhancedPrescriptionDialog({
  open,
  onOpenChange,
  patients,
  onSuccess,
  userId
}: EnhancedPrescriptionDialogProps) {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState<PrescriptionItem[]>([
    {
      medication_id: '',
      medication_name: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 1,
      instructions: '',
      unit_price: 0,
      include_in_billing: true
    }
  ]);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMedications();
    }
  }, [open]);

  const fetchMedications = async () => {
    const { data } = await supabase
      .from('medications')
      .select('*')
      .order('name');
    setMedications(data || []);
  };

  const addPrescriptionItem = () => {
    setPrescriptionItems([
      ...prescriptionItems,
      {
        medication_id: '',
        medication_name: '',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        instructions: '',
        unit_price: 0,
        include_in_billing: true
      }
    ]);
  };

  const removePrescriptionItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const updatePrescriptionItem = (index: number, field: keyof PrescriptionItem, value: any) => {
    const updated = [...prescriptionItems];
    updated[index] = { ...updated[index], [field]: value };

    // If medication is selected, update price and name
    if (field === 'medication_id' && value) {
      const med = medications.find(m => m.id === value);
      if (med) {
        updated[index].medication_name = `${med.name} - ${med.strength}`;
        updated[index].unit_price = med.unit_price;
      }
    }

    setPrescriptionItems(updated);
  };

  const calculateTotalCost = () => {
    return prescriptionItems
      .filter(item => item.include_in_billing)
      .reduce((total, item) => total + (item.unit_price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    if (!selectedPatientId) {
      toast.error('Please select a patient');
      return;
    }

    const validItems = prescriptionItems.filter(
      item => item.medication_name && item.dosage && item.quantity > 0
    );

    if (validItems.length === 0) {
      toast.error('Please add at least one valid medication');
      return;
    }

    setLoading(true);
    try {
      // Insert all prescriptions
      const prescriptionsToInsert = validItems.map(item => ({
        patient_id: selectedPatientId,
        doctor_id: userId,
        medication_id: item.medication_id || null,
        medication_name: item.medication_name,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions || null,
        notes: clinicalNotes || null,
        status: 'Pending',
        prescribed_date: new Date().toISOString(),
        unit_price: item.unit_price,
        include_in_billing: item.include_in_billing
      }));

      const { data: insertedPrescriptions, error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert(prescriptionsToInsert)
        .select();

      if (prescriptionError) throw prescriptionError;

      // Update patient visit workflow to move to pharmacy
      const { data: visits } = await supabase
        .from('patient_visits')
        .select('*')
        .eq('patient_id', selectedPatientId)
        .eq('current_stage', 'doctor')
        .eq('overall_status', 'Active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (visits && visits.length > 0) {
        await supabase
          .from('patient_visits')
          .update({
            doctor_status: 'Completed',
            doctor_completed_at: new Date().toISOString(),
            current_stage: 'pharmacy',
            pharmacy_status: 'Pending'
          })
          .eq('id', visits[0].id);
      }

      toast.success(`${validItems.length} prescription(s) created successfully`);
      onOpenChange(false);
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Error creating prescriptions:', error);
      toast.error(`Failed to create prescriptions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedPatientId('');
    setPrescriptionItems([
      {
        medication_id: '',
        medication_name: '',
        dosage: '',
        frequency: '',
        duration: '',
        quantity: 1,
        instructions: '',
        unit_price: 0,
        include_in_billing: true
      }
    ]);
    setClinicalNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Write Prescription (Multiple Medications)</DialogTitle>
    );
}
/Dialog>
 t>
    <enDialogCont
      </      </div>  </div>
    >
       </Button          )}
             </>
           s)
       escription(h} Prms.lengtteionIscripte {pre Creat          
        />-2 h-4 w-4"me="mrassNacl<Pill                      <>
             (
  ) :             />
      <        
  ating...  Cre              
  -spin" />imate2 h-4 w-4 ane="mr-lassNam c <Pill       
          >         <   
    ing ? (       {load      ding}>
 loaled={isabubmit} deShandln onClick={ <Butto            </Button>
           
    Cancel          ading}>
led={loabfalse)} disenChange(={() => onOpe" onClick"outlinriant=n va      <Butto">
      4 border-t-2 pt--end gapex justifyme="fldiv classNa   <  
     ons */}Acti    {/* 

      >    </div  />
         {3}
        rows=             .."
ten. were writptionscri these prest whyous ab"Noteholder=    place
          )}luetarget.vaNotes(e.nicaletClie) => se={(  onChang         
   es}{clinicalNot  value=        tarea
          <Tex     
 el>Notes</Labl>Clinical <Labe         ">
   -y-2spacelassName="    <div c  /}
    l Notes *nica   {/* Cli
       </div>
        >
     </p        ted
 " are counillingude in bked "Inclns maricationly med  O            
t-1">0 m-green-70extt-xs t="texclassNamep        <        </div>
         </span>
            ing()}
  oLocaleStrlCost().tTotalculate  TSh {ca         
     ">600ext-green-nt-bold text-2xl fossName="t   <span cla    
       </span>le Amount:BillabTotal een-800">xt-grsemibold teame="font-lassN <span c  
           tween">tify-ber jus-centeex itemssName="fllas      <div c    >
  "-green-200rderg border bo-ledund ro-50-greenme="p-4 bg<div classNa      t */}
    Total Cos {/* 
         v>
     </di}
           ))div>
            </      )}
                 
      </div>    >
           </span                  
      )}            e>
    illed</Badg>Not b""ml-2ssName=dary" cla"seconant=dge vari    <Ba            (
        g && illinnclude_in_bm.i    {!ite        
          }ring()ocaleStty).toLquantirice * item.unit_ptem.TSh {(ist:    Co                  um">
 -medintm foext-ssName="t clas   <span              
   >" /blue-600w-4 text-Name="h-4 n classSig     <Dollar              >
 ue-200"bler border-rounded bord bg-blue-50  p-2ter gap-2ems-cene="flex itamdiv classN    <             && (
 rice > 0 _pittem.un   {i             
>
       </div            />
             od"
  ke with fo="e.g., Taer  placehold           }
       e).valu.targetions', euctndex, 'instr(itemrescriptionItePe) => upda={(  onChange                  ns}
tructiom.insue={ite      val          nput
           <I           >
</LabelionsctInstru <Label>               2">
  y-e-spacme="div classNa        <

        v></di        >
               </div      />
                   
       min="1"                  alue))}
   .target.vr(eNumbentity', x, 'quaionItem(indescriptePrepdat) => unge={(e onCha                   ity}
  .quantalue={item      v              mber"
  ="nutype                     Input
  <                 
  el>abuantity *</Ll>QLabe <               >
    e-y-2"="spac className   <div            /div>

         <           
 >          /     "
     .g., 7 days"eholder=       place        
       rget.value)}ta e. 'duration',nItem(index,tioriptePresc> updae={(e) =Chang      on      
          .duration}alue={item v                     nput
   <I      
           bel> *</Lal>Duration       <Labe      
       -y-2">ace="spNameclass<div                   /div>

     <            />
                    "
 ilyTwice dar="e.g., oldeaceh pl                    )}
 alue, e.target.v'frequency'x, nItem(indeptiopdatePrescri> uge={(e) =      onChan          
      uency}.freqalue={item      v          t
      Inpu        <            bel>
 *</Larequencyl>F      <Labe             
 >ce-y-2"spaclassName="       <div          >

         </div             />
                  
 500mg""e.g.,older= placeh                    }
 rget.value)e', e.tasagdex, 'doptionItem(inscripdatePre(e) => u  onChange={             ge}
       osatem.d    value={i                
       <Input              
 >abele *</Lsag  <Label>Do            ">
      -2e-yacspsName=" <div clas         
        gap-3">4 d-cols-d griName="griv class     <di     >

       </div       
           </div>       
           />               "
   500mgParacetamolr="e.g., olde  placeh               lue)}
     t.va', e.targenamen_atio 'medicx,de(inemscriptionItrepdatePge={(e) => uan       onCh             ame}
  tion_nedicaitem.m   value={                   
 <Input                  
 e *</Label>amMedication NEnter l>Or abe     <L         >
      pace-y-2""sssName= cladiv         <          </div>

                 ect>
sel</                 }
       ))              n>
    optio    </                  rice}
  t_p {med.uniock}) - TShy_in_stuantit{med.qtock:  (Sngth} - {med.streed.name}      {m                    ed.id}>
id} value={mmed.key={option    <               (
      p((med) => ons.ma  {medicati         
           </option>t medication">Selece="ption valu        <o    
                 >           }
  t.value)gee.tartion_id', dex, 'medicam(inItetioncrippdatePres={(e) => u    onChange              n_id}
    edicatiolue={item.m          va            md"
r rounded- borde-full p-2e="wssNam    cla            
         <select              el>
   ory</Labventom Int frl>Selec  <Labe                 
 e-y-2">Name="spac class<div            ">
      cols-2 gap-3d grid-griame=" classN     <div          v>

        </di          </div>
                   )}
              n>
    /Butto  <                    4 w-4" />
sName="h-rash2 clas        <T       
              >              ndex)}
   ptionItem(iePrescri{() => removck=li     onC             sm"
      ="ize s              
         tive"ruc="dest   variant                "
     tonbut   type="                 n
          <Butto              (
   1 &&.length > nItemsptioprescri   {           iv>
        </d                 g</Label>
  in billincludesm">Iname="text-el classN     <Lab                 />
               }
                              ecked)
 ng', chn_billilude_i'inc(index, criptionItemPres     update                   ) =>
  ge={(checkedan onCheckedCh                      ling}
 de_in_bil{item.inclu    checked=                   eckbox
 <Ch                
      ">r gap-2ente items-came="flex<div classN             ">
       er gap-2-centx itemsName="flessv cla <di           
      </h4> 1}on #{index +atim">Mediciumedme="font-sNalas<h4 c             
     en">etwe justify-bterx items-cename="fleassNiv cl     <d           ">
-50-3 bg-graypace-y slgrounded-border me="p-4  classNaex}nd={i <div key     (
        ) => ndex item,map((items.ptionI{prescri           

  </div>          tton>
 /Bu          <n
    dicatio Add Me          />
      4 w-4 mr-2"h-me="Plus classNa    <            }>
criptionItemaddPres" onClick={ze="sm" si"buttonpe=n tytto <Bu           Label>
  dications</ld">Me font-semibotext-lglassName="Label c   <           en">
stify-betwe-center julex itemsName="f<div class      >
      -y-4"ame="space<div classN          */}
n Items ioiptPrescr        {/* div>

        </  lect>
  /se        <
       ))}      >
         </option       
     ll_name}patient.fu           {  }>
     t.idpatien.id} value={={patienton key    <opti            ) => (
(patients.map(  {patient   
         n>t</optioatienlect palue="">Seon v  <opti     
                >alue)}
   et.vntId(e.targctedPatie => setSele(e)onChange={           
   PatientId}={selected       value     ded-md"
  order rounfull p-2 bw-Name="      classct
              <sele   Label>
   nt *</tieLabel>Pa         <  -2">
 me="space-yiv classNa <d
         lection */}Patient Se    {/*      4">
 y-ame="space-v classN      <diader>

  DialogHe
        </ion>ogDescript</Dial         ling.
 clude in bilto ink/uncheck t. Checenor the patitions ftiple medica Select mul        on>
   gDescripti   <Dialo    