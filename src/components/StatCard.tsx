import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  color: string;
  sub: string;
}

export function StatCard({ title, value, icon: Icon, color, sub }: StatCardProps) {
  const colorClasses = {
    green: 'border-green-200 shadow-lg bg-green-50',
    blue: 'border-blue-200 shadow-lg bg-blue-50',
    purple: 'border-purple-200 shadow-lg bg-purple-50',
    orange: 'border-orange-200 shadow-lg bg-orange-50',
  };

  const iconColors = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
  };

  return (
    <Card className={colorClasses[color as keyof typeof colorClasses]}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${iconColors[color as keyof typeof iconColors]}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${iconColors[color as keyof typeof iconColors]}`}>
          {value}
        </div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
