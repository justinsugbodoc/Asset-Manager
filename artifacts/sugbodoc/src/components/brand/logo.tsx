import { HeartPulse } from 'lucide-react';

type LogoProps = {
  compact?: boolean;
  className?: string;
};

export default function Logo({ compact = false, className = '' }: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`} aria-label="SugboDoc">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-sm">
        <HeartPulse className="h-5 w-5" strokeWidth={2.5} />
      </span>
      {!compact && (
        <span className="text-xl font-bold tracking-tight text-primary">SugboDoc</span>
      )}
    </div>
  );
}