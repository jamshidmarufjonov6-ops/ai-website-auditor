import ReportClient from "./ReportClient";

export default function Page({ params }: { params: { id: string } }) {
  return <ReportClient publicId={params.id} />;
}
