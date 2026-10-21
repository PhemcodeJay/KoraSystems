import { AdminHome } from "../../admin-home";

export const dynamic = "force-dynamic";

/**
 * The platform console.
 *
 * Reuses AdminHome rather than porting the old client dashboard: the stats
 * there are computed server-side from the same queries, and the action tiles
 * already link to the /admin/* pages below.
 */
export default function AdminOverviewPage() {
  return <AdminHome />;
}
