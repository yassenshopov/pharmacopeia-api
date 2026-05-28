import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  sublabel?: string;
  className?: string;
}

export function StatCard({ label, value, sublabel, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border/80 bg-card/40 p-5",
        className,
      )}
    >
      <span className="font-mono text-3xl font-semibold tracking-tight">
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="mt-1 text-sm font-medium">{label}</span>
      {sublabel && (
        <span className="mt-0.5 text-xs text-muted-foreground">{sublabel}</span>
      )}
    </div>
  );
}
