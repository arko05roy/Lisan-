const STORAGE_KEY = "lisan-relayers";

export interface Relayer {
  id: string;
  name: string;
  url: string;
  address: string;
  feeBps: number;
  status: "online" | "offline" | "unknown";
  isDefault: boolean;
}

export interface RelayerInfo {
  name: string;
  address: string;
  feeBps: number;
}

const DEFAULT_RELAYER: Relayer = {
  id: "self",
  name: "Lisan Default",
  url: "",
  address: "",
  feeBps: 50,
  status: "unknown",
  isDefault: true,
};

function loadCustomRelayers(): Relayer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Relayer[]) : [];
  } catch {
    return [];
  }
}

function saveCustomRelayers(relayers: Relayer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(relayers));
}

export function getRelayers(): Relayer[] {
  return [DEFAULT_RELAYER, ...loadCustomRelayers()];
}

export async function addRelayer(url: string): Promise<Relayer> {
  const trimmed = url.replace(/\/+$/, "");
  const res = await fetch(`${trimmed}/api/relay/info`);
  if (!res.ok) throw new Error("Failed to fetch relayer info");
  const info: RelayerInfo = await res.json();

  const relayer: Relayer = {
    id: crypto.randomUUID(),
    name: info.name,
    url: trimmed,
    address: info.address,
    feeBps: info.feeBps,
    status: "online",
    isDefault: false,
  };

  const existing = loadCustomRelayers();
  if (existing.some((r) => r.url === trimmed)) {
    throw new Error("Relayer already added");
  }
  saveCustomRelayers([...existing, relayer]);
  return relayer;
}

export function removeRelayer(id: string) {
  const existing = loadCustomRelayers();
  saveCustomRelayers(existing.filter((r) => r.id !== id));
}

export async function healthCheckRelayer(relayer: Relayer): Promise<Relayer> {
  try {
    const base = relayer.url;
    const res = await fetch(`${base}/api/relay/info`);
    if (!res.ok) return { ...relayer, status: "offline" };
    const info: RelayerInfo = await res.json();
    return {
      ...relayer,
      name: info.name,
      address: info.address,
      feeBps: info.feeBps,
      status: "online",
    };
  } catch {
    return { ...relayer, status: "offline" };
  }
}

export async function healthCheckAll(relayers: Relayer[]): Promise<Relayer[]> {
  const results = await Promise.allSettled(relayers.map(healthCheckRelayer));
  return results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { ...relayers[i], status: "offline" as const },
  );
}

export function resolveRelayerBaseUrl(relayer: Relayer): string {
  return relayer.url;
}

export function formatFee(feeBps: number): string {
  return `${(feeBps / 100).toFixed(feeBps % 100 === 0 ? 0 : 1)}%`;
}
