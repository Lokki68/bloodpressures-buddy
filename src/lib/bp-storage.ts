export type Period = "morning" | "evening";

export type Reading = {
  systolic: number;
  diastolic: number;
  pulse?: number;
  recordedAt: string;
};

/** key format: `d{1-3}-{morning|evening}-{0-2}` */
export type BpData = {
  patientName: string;
  startedAt: string;
  readings: Record<string, Reading>;
};

export const STORAGE_KEY = "bp-control-v1";
export const DAYS = [1, 2, 3] as const;
export const PERIODS: Period[] = ["morning", "evening"];
export const SLOTS = [0, 1, 2] as const;
export const TOTAL_READINGS = DAYS.length * PERIODS.length * SLOTS.length;

export const periodLabel = (p: Period) => (p === "morning" ? "Matin" : "Soir");

export const slotKey = (day: number, period: Period, slot: number) =>
  `d${day}-${period}-${slot}`;

export const emptyData = (): BpData => ({
  patientName: "",
  startedAt: new Date().toISOString(),
  readings: {},
});

function normalize(parsed: BpData): BpData {
  return {
    patientName: parsed.patientName ?? "",
    startedAt: parsed.startedAt ?? new Date().toISOString(),
    readings: parsed.readings ?? {},
  };
}

export async function loadData(): Promise<BpData> {
  if (typeof window === "undefined") return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const json = raw.startsWith(CIPHER_PREFIX)
      ? await decryptString(raw)
      : raw; // données historiques en clair
    return normalize(JSON.parse(json) as BpData);
  } catch {
    return emptyData();
  }
}

export async function saveData(data: BpData) {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(data);
  try {
    if (!isSupported()) throw new Error("crypto indisponible");
    window.localStorage.setItem(STORAGE_KEY, await encryptString(json));
  } catch {
    window.localStorage.setItem(STORAGE_KEY, json);
  }
}

export async function clearData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  await destroyKey();
}


const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

export type Stats = {
  count: number;
  systolic: number;
  diastolic: number;
  pulse: number | null;
};

export function statsFor(readings: Reading[]): Stats {
  const pulses = readings.map((r) => r.pulse).filter((p): p is number => !!p);
  return {
    count: readings.length,
    systolic: Math.round(avg(readings.map((r) => r.systolic))),
    diastolic: Math.round(avg(readings.map((r) => r.diastolic))),
    pulse: pulses.length ? Math.round(avg(pulses)) : null,
  };
}

export function collect(
  data: BpData,
  filter?: { day?: number; period?: Period },
): Reading[] {
  const out: Reading[] = [];
  for (const day of DAYS) {
    if (filter?.day && filter.day !== day) continue;
    for (const period of PERIODS) {
      if (filter?.period && filter.period !== period) continue;
      for (const slot of SLOTS) {
        const r = data.readings[slotKey(day, period, slot)];
        if (r) out.push(r);
      }
    }
  }
  return out;
}

/** Self-measurement thresholds (ESH/HAS): normal < 135/85 at home. */
export function interpret(s: Stats) {
  if (!s.count) return { label: "Aucune donnée", tone: "muted" as const };
  if (s.systolic < 135 && s.diastolic < 85)
    return { label: "Automesure normale", tone: "ok" as const };
  if (s.systolic >= 160 || s.diastolic >= 100)
    return { label: "Valeurs élevées — consultez rapidement", tone: "high" as const };
  return { label: "Hypertension probable en automesure", tone: "warn" as const };
}

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
