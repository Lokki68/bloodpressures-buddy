import { useState } from "react";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Reading } from "@/lib/bp-storage";

type Props = {
  index: number;
  reading?: Reading;
  onSave: (reading: Reading) => void;
  onDelete: () => void;
};

export function ReadingSlot({ index, reading, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [systolic, setSystolic] = useState(reading ? String(reading.systolic) : "");
  const [diastolic, setDiastolic] = useState(reading ? String(reading.diastolic) : "");
  const [pulse, setPulse] = useState(reading?.pulse ? String(reading.pulse) : "");
  const [error, setError] = useState<string | null>(null);

  const open = editing || !reading;

  const submit = () => {
    const sys = Number(systolic);
    const dia = Number(diastolic);
    const pul = pulse ? Number(pulse) : undefined;
    if (!sys || !dia || sys < 50 || sys > 300 || dia < 30 || dia > 200) {
      setError("Valeurs attendues : systole 50-300, diastole 30-200.");
      return;
    }
    if (dia >= sys) {
      setError("La diastole doit être inférieure à la systole.");
      return;
    }
    setError(null);
    onSave({
      systolic: sys,
      diastolic: dia,
      ...(pul && pul > 20 && pul < 250 ? { pulse: pul } : {}),
      recordedAt: reading?.recordedAt ?? new Date().toISOString(),
    });
    setEditing(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mesure {index + 1}
        </span>
        {reading && !editing && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`Modifier la mesure ${index + 1}`}
              onClick={() => setEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              aria-label={`Supprimer la mesure ${index + 1}`}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {!open && reading ? (
        <div className="flex items-baseline gap-2 font-mono">
          <span className="text-2xl font-semibold text-foreground">
            {reading.systolic}
            <span className="mx-0.5 text-muted-foreground">/</span>
            {reading.diastolic}
          </span>
          <span className="text-xs text-muted-foreground">
            mmHg{reading.pulse ? ` · ${reading.pulse} bpm` : ""}
          </span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Input
              inputMode="numeric"
              placeholder="SYS"
              aria-label="Systole"
              value={systolic}
              onChange={(e) => setSystolic(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono"
            />
            <Input
              inputMode="numeric"
              placeholder="DIA"
              aria-label="Diastole"
              value={diastolic}
              onChange={(e) => setDiastolic(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono"
            />
            <Input
              inputMode="numeric"
              placeholder="Pouls"
              aria-label="Pouls"
              value={pulse}
              onChange={(e) => setPulse(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" className="w-full" onClick={submit}>
            <Check className="size-3.5" /> Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
}
