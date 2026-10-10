import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  color: 'blue' | 'green' | 'orange' | 'red';
}

const colorClasses = {
  blue: 'bg-blue-500/10 text-blue-400',
  green: 'bg-green-500/10 text-green-400',
  orange: 'bg-orange-500/10 text-orange-400',
  red: 'bg-red-500/10 text-red-400',
};

export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  color,
}: StatCardProps) {
  const gradientColors = {
    blue: 'from-blue-600 to-indigo-600 shadow-blue-500/20',
    green: 'from-emerald-500 to-teal-500 shadow-emerald-500/20',
    orange: 'from-orange-500 to-amber-500 shadow-orange-500/20',
    red: 'from-red-500 to-rose-500 shadow-red-500/20',
  };

  const textColors = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    orange: 'text-orange-400',
    red: 'text-rose-400',
  };

  return (
    <div className="group bg-card backdrop-blur-md rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-foreground/5 to-transparent rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />

      <div className="flex items-start justify-between relative z-10">
        <div>
          <p className="text-muted-foreground text-sm font-medium mb-1 tracking-wide uppercase">{title}</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-bold text-foreground tracking-tight">{value}</h3>
          </div>

          {change && (
            <div className="flex items-center gap-1.5 mt-3">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${textColors[color].replace('text-', 'bg-')}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${textColors[color].replace('text-', 'bg-')}`}></span>
              </span>
              <p className={`text-xs font-medium ${textColors[color]}`}>
                {change}
              </p>
            </div>
          )}
        </div>

        <div className={`p-3.5 rounded-xl bg-gradient-to-br ${gradientColors[color]} shadow-lg text-foreground transform group-hover:scale-110 transition-transform duration-300`}>
          <Icon size={22} className="stroke-[2.5]" />
        </div>
      </div>
    </div>
  );
}
