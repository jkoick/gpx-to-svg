import { Skeleton } from "@/components/ui/skeleton";

export function SVGPreviewSkeleton() {
  return (
    <div className="border-2 border-dashed border-muted rounded-lg min-h-[400px] bg-muted/20 p-4">
      <div className="w-full h-full flex flex-col space-y-4">
        {/* Header skeleton */}
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        
        {/* Main content skeleton */}
        <div className="flex-1 relative">
          <Skeleton className="absolute inset-0 rounded" />
          
          {/* Simulated map elements */}
          <div className="absolute inset-4 space-y-2">
            <div className="flex items-center justify-center h-8">
              <Skeleton className="h-4 w-48 rounded-full" />
            </div>
            <div className="grid grid-cols-8 gap-1 mt-4">
              {Array.from({ length: 24 }).map((_, i) => (
                <Skeleton key={i} className="h-2 rounded-sm" />
              ))}
            </div>
            <div className="flex justify-center mt-8">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 mx-auto">
                  <Skeleton className="w-full h-full rounded-full" />
                </div>
                <Skeleton className="h-4 w-32 mx-auto" />
                <Skeleton className="h-3 w-48 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ConfigSkeleton() {
  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}