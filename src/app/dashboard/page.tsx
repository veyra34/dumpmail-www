import { Suspense } from "react";
import Dashboard from "@/screens/Dashboard";
import DashboardLoading from "./loading";

export default function Page() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Dashboard />
    </Suspense>
  );
}