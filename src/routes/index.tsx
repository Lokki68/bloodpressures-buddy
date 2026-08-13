import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, Download, HeartPulse, Moon, Sun, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReadingSlot } from "@/components/bp/ReadingSlot";
import { downloadReportPdf } from "@/lib/bp-pdf";
import {
  DAYS,
  PERIODS,
  SLOTS,
  TOTAL_READINGS,
  clearData,
  collect,
  emptyData,
  interpret,
  loadData,
  periodLabel,
  saveData,
  slotKey,
  statsFor,
  type BpData,
  type Period,
  type Reading,
} from "@/lib/bp-storage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tensio — Suivi d'automesure tensionnelle sur 3 jours" },
      {
        name: "description",
        content:
          "Enregistrez 3 mesures le matin et 3 le soir pendant 3 jours, calculez votre moyenne tensionnelle et téléchargez le compte rendu PDF pour votre médecin.",
      },
      { property: "og:title", content: "Tensio — Automesure tensionnelle 3 jours" },
      {
        property: "og:description",
        content:
          "Relevé guidé d'automesure : 18 mesures, moyennes automatiques et compte rendu PDF prêt à imprimer.",
      },
    ],
  }),
  component: Index,
});

const toneClass = {
  ok: "bg-ok/25 text-ok-foreground",
  warn: "bg-warn/30 text-warn-foreground",
  high: "bg-high text-high-foreground",
  muted: "bg-muted text-muted-foreground",
};

function Index() {
  const [data, setData] = useState<BpData>(emptyData);
  const [hydrated, setHydrated] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void loadData().then((loaded) => {
      if (!active) return;
      setData(loaded);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const update = (next: BpData) => {
    setData(next);
    void saveData(next);
  };


  const setReading = (key: string, reading: Reading) => {
    update({ ...data, readings: { ...data.readings, [key]: reading } });
  };

  const removeReading = (key: string) => {
    const readings = { ...data.readings };
    delete readings[key];
    update({ ...data, readings });
  };

  const all = useMemo(() => collect(data), [data]);
  const global = statsFor(all);
  const conclusion = interpret(global);
  const complete = all.length === TOTAL_READINGS;

  const handleDownload = async () => {
    try {
      await downloadReportPdf(data);
      setConfirmOpen(true);
    } catch {
      toast.error("Le PDF n'a pas pu être généré.");
    }
  };

  const confirmDelete = () => {
    void clearData();
    setData(emptyData());
    setConfirmOpen(false);
    toast.success("Relevé supprimé et clé de chiffrement détruite.");
  };


  return (
    <div className="min-h-screen bg-calm">
      <Toaster />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-10 sm:px-6">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground">
            <HeartPulse className="size-3.5 text-primary" /> Automesure sur 3 jours
          </div>
          <h1 className="text-4xl leading-tight text-foreground sm:text-5xl">
            Contrôle de la tension artérielle
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Trois mesures le matin et trois le soir, pendant trois jours. À la fin,
            la moyenne est calculée et votre compte rendu PDF est prêt pour votre
            médecin.
          </p>
        </header>

        <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="patient">Nom du patient</Label>
              <Input
                id="patient"
                placeholder="Prénom et nom"
                value={data.patientName}
                onChange={(e) => update({ ...data, patientName: e.target.value })}
              />
            </div>
            <div className="text-right">
              <p className="font-mono text-sm text-muted-foreground">
                {all.length} / {TOTAL_READINGS} mesures
              </p>
              <Progress
                value={(all.length / TOTAL_READINGS) * 100}
                className="mt-2 w-40"
              />
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Activity className="size-3.5" /> Moyenne globale
              </p>
              <p className="mt-2 font-mono text-5xl font-semibold text-foreground">
                {global.count ? `${global.systolic}/${global.diastolic}` : "—/—"}
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  mmHg
                </span>
              </p>
              {global.pulse && (
                <p className="mt-1 font-mono text-sm text-muted-foreground">
                  Pouls moyen : {global.pulse} bpm
                </p>
              )}
            </div>
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${toneClass[conclusion.tone]}`}
            >
              {conclusion.label}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handleDownload} disabled={!global.count}>
              <Download className="size-4" /> Télécharger le compte rendu PDF
            </Button>
            {!complete && (
              <p className="self-center text-xs text-muted-foreground">
                {TOTAL_READINGS - all.length} mesure(s) restante(s) pour un relevé
                complet.
              </p>
            )}
          </div>
        </section>

        {hydrated &&
          DAYS.map((day) => (
            <section key={day} className="mb-8">
              <h2 className="mb-4 text-2xl text-foreground">Jour {day}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {PERIODS.map((period) => (
                  <PeriodCard
                    key={period}
                    day={day}
                    period={period}
                    data={data}
                    onSave={setReading}
                    onDelete={removeReading}
                  />
                ))}
              </div>
            </section>
          ))}

        <section className="rounded-2xl border border-border bg-card/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Vos données restent sur cet appareil, chiffrées (AES-256-GCM) dans le
              stockage local du navigateur, et sont effacées après téléchargement,
              avec votre accord.
            </p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              disabled={!global.count}
            >
              <Trash2 className="size-3.5" /> Effacer le relevé
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Seuil de référence en automesure : moyenne normale inférieure à 135/85
            mmHg. Ce suivi ne remplace pas un avis médical.
          </p>
        </section>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer les mesures enregistrées ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vérifiez d'abord que le PDF a bien été téléchargé : cette suppression
              est définitive et effacera les {all.length} mesure(s) stockées sur cet
              appareil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver les données</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PeriodCard({
  day,
  period,
  data,
  onSave,
  onDelete,
}: {
  day: number;
  period: Period;
  data: BpData;
  onSave: (key: string, reading: Reading) => void;
  onDelete: (key: string) => void;
}) {
  const stats = statsFor(collect(data, { day, period }));
  const Icon = period === "morning" ? Sun : Moon;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg text-foreground">
          <Icon className="size-4 text-primary" /> {periodLabel(period)}
        </h3>
        <span className="font-mono text-xs text-muted-foreground">
          {stats.count
            ? `moy. ${stats.systolic}/${stats.diastolic}`
            : "0/3 mesures"}
        </span>
      </div>
      <div className="space-y-2">
        {SLOTS.map((slot) => {
          const key = slotKey(day, period, slot);
          const reading = data.readings[key];
          return (
            <ReadingSlot
              key={key}
              index={slot}
              {...(reading ? { reading } : {})}
              onSave={(r) => onSave(key, r)}
              onDelete={() => onDelete(key)}
            />
          );
        })}
      </div>
    </div>
  );
}
