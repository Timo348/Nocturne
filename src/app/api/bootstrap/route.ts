import { getBootstrapData } from "@/lib/dashboard-data";
import { jsonError } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(await getBootstrapData(user));
  } catch (error) {
    return jsonError(error);
  }
}
