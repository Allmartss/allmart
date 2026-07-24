import { useState } from "react";
import { Sparkles, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const LINE_OPTIONS = [
  { label: "3 sentences", value: 3 },
  { label: "5 sentences", value: 5 },
  { label: "8 sentences", value: 8 },
  { label: "12 sentences", value: 12 },
];

interface AiDescriptionButtonProps {
  name: string;
  category: string;
  onGenerate: (description: string) => void;
}

export function AiDescriptionButton({ name, category, onGenerate }: AiDescriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState(3);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!name.trim()) {
      setError("Enter a product name first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/ai/generate-description", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), category: category.trim() || "general", lines }),
      });
      const data = await res.json() as { description?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      onGenerate(data.description ?? "");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    setOpen(false);
    setError(null);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {!open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs px-2.5 text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/60"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="h-3 w-3" />
          AI Generate
        </Button>
      ) : (
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <select
            value={lines}
            onChange={(e) => setLines(Number(e.target.value))}
            disabled={loading}
            className="h-7 text-xs rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {LINE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            className="h-7 gap-1.5 text-xs px-2.5"
            onClick={generate}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {loading ? "Generating…" : "Generate"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={cancel}
            disabled={loading}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
