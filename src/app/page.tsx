import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBootstrapData } from "@/lib/dashboard-data";
import DashboardApp from "@/components/dashboard-app";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const data = await getBootstrapData(user);
  return <DashboardApp initialData={data} />;
}
