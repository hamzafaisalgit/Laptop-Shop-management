import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';

const schema = z.object({
  brand: z.string().min(1, 'Required'),
  model: z.string().min(1, 'Required'),
  modelNumber: z.string().optional(),
  condition: z.enum(['New', 'Used', 'Refurbished', 'Open-box']),
  trackingMode: z.enum(['unit', 'batch']),
  serialNumber: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  costPrice: z.coerce.number().min(0, 'Required'),
  sellingPrice: z.coerce.number().min(0, 'Required'),
  minSalePrice: z.coerce.number().min(0).optional().or(z.literal('')),
  supplier: z.string().optional(),
  warrantyMonths: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
  // specs
  processor: z.string().optional(),
  generation: z.string().optional(),
  ram: z.string().optional(),
  storage: z.string().optional(),
  gpu: z.string().optional(),
  display: z.string().optional(),
  battery: z.string().optional(),
  os: z.string().optional(),
  keyboard: z.string().optional(),
  ports: z.string().optional(),
  weight: z.string().optional(),
  color: z.string().optional(),
});

function Field({ label, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function LaptopFormDialog({ open, onClose, laptop, onSaved }) {
  const { user } = useAuth();
  const isEdit = !!laptop;
  const [specsOpen, setSpecsOpen] = useState(false);
  const [mergeDialog, setMergeDialog] = useState(null);
  const [pendingData, setPendingData] = useState(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      condition: 'New',
      trackingMode: 'batch',
      quantity: 1,
      warrantyMonths: 0,
    },
  });

  const condition = watch('condition');
  const trackingMode = watch('trackingMode');

  // Auto-suggest trackingMode when condition changes
  useEffect(() => {
    if (!isEdit) setValue('trackingMode', condition === 'New' ? 'batch' : 'unit');
  }, [condition, isEdit, setValue]);

  // Populate form for edit
  useEffect(() => {
    if (laptop) {
      reset({
        brand: laptop.brand || '',
        model: laptop.model || '',
        modelNumber: laptop.modelNumber || '',
        condition: laptop.condition || 'New',
        trackingMode: laptop.trackingMode || 'batch',
        serialNumber: laptop.serialNumber || '',
        quantity: laptop.quantity ?? 1,
        costPrice: laptop.costPrice ?? '',
        sellingPrice: laptop.sellingPrice ?? '',
        minSalePrice: laptop.minSalePrice ?? '',
        supplier: laptop.supplier || '',
        warrantyMonths: laptop.warrantyMonths ?? 0,
        notes: laptop.notes || '',
        processor: laptop.specs?.processor || '',
        generation: laptop.specs?.generation || '',
        ram: laptop.specs?.ram || '',
        storage: laptop.specs?.storage || '',
        gpu: laptop.specs?.gpu || '',
        display: laptop.specs?.display || '',
        battery: laptop.specs?.battery || '',
        os: laptop.specs?.os || '',
        keyboard: laptop.specs?.keyboard || '',
        ports: laptop.specs?.ports || '',
        weight: laptop.specs?.weight || '',
        color: laptop.specs?.color || '',
      });
    }
  }, [laptop, reset]);

  const buildPayload = (data) => ({
    brand: data.brand,
    model: data.model,
    modelNumber: data.modelNumber || undefined,
    condition: data.condition,
    trackingMode: data.trackingMode,
    serialNumber: data.trackingMode === 'unit' ? data.serialNumber : undefined,
    quantity: data.trackingMode === 'batch' ? data.quantity : 1,
    costPrice: data.costPrice,
    sellingPrice: data.sellingPrice,
    minSalePrice: data.minSalePrice || undefined,
    supplier: data.supplier || undefined,
    warrantyMonths: data.warrantyMonths,
    notes: data.notes || undefined,
    specs: {
      processor: data.processor || undefined,
      generation: data.generation || undefined,
      ram: data.ram || undefined,
      storage: data.storage || undefined,
      gpu: data.gpu || undefined,
      display: data.display || undefined,
      battery: data.battery || undefined,
      os: data.os || undefined,
      keyboard: data.keyboard || undefined,
      ports: data.ports || undefined,
      weight: data.weight || undefined,
      color: data.color || undefined,
    },
  });

  const submit = async (data, forceParam) => {
    try {
      const payload = buildPayload(data);
      let res;
      if (isEdit) {
        res = await api.patch(`/laptops/${laptop._id}`, payload);
      } else {
        const url = forceParam ? `/laptops?${forceParam}=true` : '/laptops';
        res = await api.post(url, payload);
      }
      toast.success(isEdit ? 'Laptop updated' : 'Laptop added');
      onSaved?.(res.data);
      onClose();
    } catch (err) {
      if (err?.response?.status === 409 && err.response.data?.mergeAvailable) {
        setPendingData(data);
        setMergeDialog(err.response.data);
      } else {
        toast.error(err?.response?.data?.message || 'Save failed');
      }
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose}>
        <DialogContent title={isEdit ? 'Edit Laptop' : 'Add Laptop'} onClose={onClose} className="max-w-2xl">
          <form onSubmit={handleSubmit((d) => submit(d, null))} className="space-y-5">
            {/* Tracking mode */}
            <div className="flex gap-3">
              {['batch', 'unit'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setValue('trackingMode', mode)}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                    trackingMode === mode
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {mode === 'batch' ? '📦 New Stock (Batch)' : '🖥️ Single Unit'}
                </button>
              ))}
            </div>

            {/* Core fields */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Brand *" error={errors.brand?.message}>
                <Input placeholder="Dell" {...register('brand')} />
              </Field>
              <Field label="Model *" error={errors.model?.message}>
                <Input placeholder="XPS 13" {...register('model')} />
              </Field>
              <Field label="Model Number" error={errors.modelNumber?.message}>
                <Input placeholder="9310" {...register('modelNumber')} />
              </Field>
              <Field label="Condition *" error={errors.condition?.message}>
                <Select {...register('condition')}>
                  {['New', 'Used', 'Refurbished', 'Open-box'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Qty / Serial */}
            <div className="grid grid-cols-2 gap-4">
              {trackingMode === 'batch' ? (
                <Field label="Quantity *" error={errors.quantity?.message}>
                  <Input type="number" min={1} {...register('quantity')} />
                </Field>
              ) : (
                <Field label="Serial Number" error={errors.serialNumber?.message}>
                  <Input placeholder="SN123456" {...register('serialNumber')} />
                </Field>
              )}
              <Field label="Warranty (months)" error={errors.warrantyMonths?.message}>
                <Input type="number" min={0} {...register('warrantyMonths')} />
              </Field>
            </div>

            {/* Prices — admin only for cost/min */}
            <div className="grid grid-cols-3 gap-4">
              {user?.role === 'admin' && (
                <Field label="Cost Price *" error={errors.costPrice?.message}>
                  <Input type="number" min={0} placeholder="0" {...register('costPrice')} />
                </Field>
              )}
              <Field label="Selling Price *" error={errors.sellingPrice?.message}>
                <Input type="number" min={0} placeholder="0" {...register('sellingPrice')} />
              </Field>
              {user?.role === 'admin' && (
                <Field label="Min Sale Price" error={errors.minSalePrice?.message}>
                  <Input type="number" min={0} placeholder="0" {...register('minSalePrice')} />
                </Field>
              )}
            </div>

            <Field label="Supplier">
              <Input placeholder="Supplier name" {...register('supplier')} />
            </Field>

            {/* Specs toggle */}
            <div>
              <button
                type="button"
                onClick={() => setSpecsOpen((p) => !p)}
                className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                {specsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {specsOpen ? 'Hide specs' : 'Add specs (processor, RAM, storage…)'}
              </button>

              {specsOpen && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  {[
                    ['processor', 'Processor', 'Intel Core i7'],
                    ['generation', 'Generation', '11th Gen'],
                    ['ram', 'RAM', '16GB'],
                    ['storage', 'Storage', '512GB SSD'],
                    ['gpu', 'GPU', 'Intel Iris Xe'],
                    ['display', 'Display', '15.6" FHD'],
                    ['battery', 'Battery', '52Wh'],
                    ['os', 'OS', 'Windows 11'],
                    ['keyboard', 'Keyboard', 'Backlit'],
                    ['ports', 'Ports', 'USB-C x2, USB-A'],
                    ['weight', 'Weight', '1.4kg'],
                    ['color', 'Color', 'Silver'],
                  ].map(([name, label, placeholder]) => (
                    <Field key={name} label={label}>
                      <Input placeholder={placeholder} {...register(name)} />
                    </Field>
                  ))}
                </div>
              )}
            </div>

            <Field label="Notes">
              <Textarea placeholder="Optional notes…" rows={2} {...register('notes')} />
            </Field>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Add Laptop'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Merge confirmation */}
      {mergeDialog && (
        <Dialog open onClose={() => setMergeDialog(null)}>
          <DialogContent title="Identical batch found" onClose={() => setMergeDialog(null)} className="max-w-sm">
            <p className="text-sm text-slate-600 mb-4">
              An existing batch <strong>{mergeDialog.existingSku}</strong> already has{' '}
              <strong>{mergeDialog.existingQty} units</strong> with the same specs and price.
              What would you like to do?
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={async () => {
                  setMergeDialog(null);
                  await submit(pendingData, 'forceMerge');
                }}
              >
                Merge — add to existing batch
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  setMergeDialog(null);
                  await submit(pendingData, 'forceNew');
                }}
              >
                Create separate record
              </Button>
              <Button variant="ghost" onClick={() => { setMergeDialog(null); setPendingData(null); }}>
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
