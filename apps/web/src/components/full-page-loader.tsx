/** Branded full-page loader shown while the stored session is being restored. */
import { Loader2 } from "lucide-react";

import { Text } from "@/components/ui/text";

export function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <Text variant="display" color="link">
          GreatSales
        </Text>
        <Loader2 className="size-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
      </div>
    </div>
  );
}
