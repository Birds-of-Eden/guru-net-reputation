import { BarChartIcon, Calendar, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type AgentStatus = 'free' | 'partial' | 'booked';

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  totalSlots: number;
  usedSlots: number;
  freeSlots: number;
  // Add other agent properties as needed
}

interface ClientCounts {
  pending: number;
  inProgress: number;
  completed: number;
}

interface StatCardsProps {
  agents: Agent[];
  clientCounts: ClientCounts;
}

export function StatCards({ agents, clientCounts }: StatCardsProps) {
  const totalClients =
    clientCounts.pending + clientCounts.inProgress + clientCounts.completed;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <AgentStatCard agents={agents} />
      <ClientStatCard totalClients={totalClients} clientCounts={clientCounts} />
      <SlotStatCard agents={agents} />
    </div>
  );
}

interface AgentStatCardProps {
  agents: Agent[];
}

function AgentStatCard({ agents }: AgentStatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
          <CardDescription>Active agent count</CardDescription>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{agents.length}</div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <div className="flex items-center">
            <div className="mr-1 h-3 w-3 rounded-full bg-blue-500"></div>
            <span>
              Free: {agents.filter((a) => a.status === "free").length}
            </span>
          </div>
          <div className="flex items-center">
            <div className="mr-1 h-3 w-3 rounded-full bg-yellow-500"></div>
            <span>
              Partial: {agents.filter((a) => a.status === "partial").length}
            </span>
          </div>
          <div className="flex items-center">
            <div className="mr-1 h-3 w-3 rounded-full bg-red-500"></div>
            <span>
              Booked: {agents.filter((a) => a.status === "booked").length}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ClientStatCardProps {
  totalClients: number;
  clientCounts: ClientCounts;
}

function ClientStatCard({ totalClients, clientCounts }: ClientStatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          <CardDescription>Client distribution</CardDescription>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <BarChartIcon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{totalClients}</div>
        <div className="mt-2 flex items-center gap-2 text-xs">
          <div className="flex items-center">
            <div className="mr-1 h-3 w-3 rounded-full bg-yellow-500"></div>
            <span>Pending: {clientCounts.pending}</span>
          </div>
          <div className="flex items-center">
            <div className="mr-1 h-3 w-3 rounded-full bg-blue-500"></div>
            <span>In Progress: {clientCounts.inProgress}</span>
          </div>
          <div className="flex items-center">
            <div className="mr-1 h-3 w-3 rounded-full bg-green-500"></div>
            <span>Completed: {clientCounts.completed}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SlotStatCardProps {
  agents: Agent[];
}

function SlotStatCard({ agents }: SlotStatCardProps) {
  const totalSlots = agents.reduce((acc, agent) => acc + agent.totalSlots, 0);
  const usedSlots = agents.reduce((acc, agent) => acc + agent.usedSlots, 0);
  const freeSlots = agents.reduce((acc, agent) => acc + agent.freeSlots, 0);
  const usagePercentage = (usedSlots / totalSlots) * 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">Available Slots</CardTitle>
          <CardDescription>Total capacity</CardDescription>
        </div>
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{freeSlots}</div>
        <p className="text-xs text-muted-foreground">
          Out of {totalSlots} total slots
        </p>
        <Progress className="mt-2 h-2" value={usagePercentage} />
      </CardContent>
    </Card>
  );
}
