import AuditDashboard from "./AuditDashboard";

export default function Page({ params }: { params: { id: string } }) {
  return <AuditDashboard publicId={params.id} />;
}
