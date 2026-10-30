import { createFileRoute } from "@tanstack/react-router";
import { PendingDrivers } from "@/components/PendingDrivers";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  head: () => ({ meta: [
    { title: "Driver Approvals \u2014 RunSheet" },
    { name: "description", content: "Review pending driver accounts for RunSheet." },
    { property: "og:title", content: "Driver Approvals \u2014 RunSheet" },
    { property: "og:description", content: "Review pending driver accounts for RunSheet." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Driver Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Review new driver signups and approve or reject their access.
        </p>
      </div>
      <PendingDrivers />
    </div>
  );
}
