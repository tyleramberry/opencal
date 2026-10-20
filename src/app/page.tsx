import { redirect } from "next/navigation";
import { getOwner } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const owner = await getOwner();
  redirect(owner ? `/${owner.username}` : "/admin/login");
}
