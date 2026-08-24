import ShareClient from "./ShareClient";

export default function Page({ params }: { params: { shareId: string } }) {
  return <ShareClient shareId={params.shareId} />;
}
