"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Relayer,
  getRelayers,
  healthCheckAll,
  addRelayer,
  removeRelayer,
  formatFee,
} from "@/lib/relayer-registry";

interface RelayerSelectProps {
  selectedRelayer: Relayer | null;
  onSelect: (relayer: Relayer) => void;
}

export function RelayerSelect({ selectedRelayer, onSelect }: RelayerSelectProps) {
  const [relayers, setRelayers] = useState<Relayer[]>([]);
  const [customUrl, setCustomUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const initial = getRelayers();
    setRelayers(initial);

    healthCheckAll(initial).then((checked) => {
      if (cancelled) return;
      setRelayers(checked);
      if (!selectedRelayer) {
        const firstOnline = checked.find((r) => r.status === "online");
        if (firstOnline) onSelect(firstOnline);
      }
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelect(id: string) {
    const r = relayers.find((r) => r.id === id);
    if (r) onSelect(r);
  }

  async function handleAdd() {
    if (!customUrl.trim()) return;
    setAdding(true);
    setError("");
    try {
      const relayer = await addRelayer(customUrl.trim());
      setRelayers((prev) => [...prev, relayer]);
      onSelect(relayer);
      setCustomUrl("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add relayer");
    } finally {
      setAdding(false);
    }
  }

  function handleRemove(id: string) {
    removeRelayer(id);
    setRelayers((prev) => prev.filter((r) => r.id !== id));
    if (selectedRelayer?.id === id) {
      const remaining = relayers.filter((r) => r.id !== id);
      const next = remaining.find((r) => r.status === "online") ?? remaining[0] ?? null;
      if (next) onSelect(next);
    }
  }

  const statusColor = (s: Relayer["status"]) =>
    s === "online" ? "bg-green-500" : s === "offline" ? "bg-red-500" : "bg-gray-400";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Relayer</label>
        <Select value={selectedRelayer?.id ?? ""} onValueChange={handleSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a relayer" />
          </SelectTrigger>
          <SelectContent>
            {relayers.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${statusColor(r.status)}`} />
                  <span>{r.name}</span>
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {formatFee(r.feeBps)}
                  </Badge>
                  {r.isDefault && (
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      default
                    </Badge>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Remove button for non-default relayers */}
      {selectedRelayer && !selectedRelayer.isDefault && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleRemove(selectedRelayer.id)}
        >
          Remove relayer
        </Button>
      )}

      {/* Add custom relayer */}
      <div className="flex gap-2">
        <Input
          placeholder="https://relayer.example.com"
          value={customUrl}
          onChange={(e) => setCustomUrl(e.target.value)}
          className="flex-1"
        />
        <Button size="sm" disabled={adding || !customUrl.trim()} onClick={handleAdd}>
          {adding ? "Adding..." : "Add"}
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
