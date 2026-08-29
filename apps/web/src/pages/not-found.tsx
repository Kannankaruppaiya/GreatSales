/** 404 — unknown route. Routes home (which itself guards on auth). */
import { FileQuestion } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/ui/states";

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas px-4">
      <EmptyState
        icon={FileQuestion}
        title="Page not found"
        description="The page you’re looking for doesn’t exist or has moved."
        actionLabel="Go to dashboard"
        onAction={() => navigate("/")}
      />
    </div>
  );
}
