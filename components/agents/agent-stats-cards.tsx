import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, Clock } from "lucide-react";

interface AgentStatsCardsProps {
  totalAgents: number;
  activeAgents: number;
  pendingAgents: number;
  activePercentage: number;
}

export function AgentStatsCards({
  totalAgents,
  activeAgents,
  pendingAgents,
  activePercentage,
}: AgentStatsCardsProps) {
  const stats = [
    {
      title: "Total Agents",
      value: totalAgents,
      subtitle: "All registered agents",
      icon: Users,
      color: "from-blue-50 to-blue-100 dark:from-blue-950/40 dark:to-blue-900/40",
      iconColor: "text-blue-600 dark:text-blue-400",
      textColor: "text-blue-800 dark:text-blue-300",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    {
      title: "Active Agents",
      value: activeAgents,
      subtitle: `${activePercentage}% of total`,
      icon: Activity,
      color: "from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      textColor: "text-emerald-800 dark:text-emerald-300",
      borderColor: "border-emerald-200 dark:border-emerald-800",
    },
    {
      title: "Pending Approval",
      value: pendingAgents,
      subtitle: "Awaiting verification",
      icon: Clock,
      color: "from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/40",
      iconColor: "text-amber-600 dark:text-amber-400",
      textColor: "text-amber-800 dark:text-amber-300",
      borderColor: "border-amber-200 dark:border-amber-800",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className={`relative border ${stat.borderColor} bg-linear-to-b ${stat.color} shadow-sm hover:shadow-md transition-all duration-300`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div
              className={`p-2.5 rounded-xl bg-white shadow-sm border dark:bg-card ${stat.borderColor}`}
            >
              <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-semibold tracking-tight ${stat.textColor}`}
            >
              {stat.value}
            </div>
            <p className="text-xs text-gray-500 mt-1 dark:text-muted-foreground">{stat.subtitle}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
