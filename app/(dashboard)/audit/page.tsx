import { AuditTrailViewer } from "@/components/features/audit/audit-trail-viewer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Audit",
  description: "Audit trail for ShiftSync",
};

export default function AuditPage() {
  return (
    <div>
      <AuditTrailViewer />
    </div>
  );
}
