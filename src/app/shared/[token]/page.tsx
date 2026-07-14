import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SharedDashboard from "@/components/shared-dashboard";
import { getSharedDashboard } from "@/lib/dashboard-sharing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Geteiltes Dashboard · Nocturne",
  robots: { index: false, follow: false },
};

export default async function SharedDashboardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getSharedDashboard(token);
  if (!data) notFound();
  return <SharedDashboard token={token} initialDashboard={data.dashboard} catalog={data.catalog} />;
}
