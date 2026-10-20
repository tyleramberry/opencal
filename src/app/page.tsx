import { redirect } from "next/navigation";
import { getProfile } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const p = await getProfile();
  redirect(`/${p.username}`);
}
