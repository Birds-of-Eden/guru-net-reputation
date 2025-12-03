// app/api/clients/[id]/route.ts
// Thin re-export to keep the route lean; logic lives in lib/api/clients/id/handlers.ts
export { GET, PUT, POST } from "@/lib/api/clients/id/handlers";

