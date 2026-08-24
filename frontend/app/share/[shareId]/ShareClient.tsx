"use client";

import AuditDashboard from "@/app/audit/[id]/AuditDashboard";
import { api } from "@/lib/api";

export default function ShareClient({ shareId }: { shareId: string }) {
  return (
    <AuditDashboard
      publicId={shareId}
      fetchAudit={() => api.getAuditByShareId(shareId)}
      isPublic
    />
  );
}
