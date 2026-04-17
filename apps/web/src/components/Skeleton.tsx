// Reusable skeleton shimmer components — Discord-style loading placeholders

/** Single shimmer block */
export function Sk({ w = 'w-full', h = 'h-4', className = '' }: { w?: string; h?: string; className?: string }) {
  return <div className={`skeleton ${w} ${h} ${className}`} />;
}

/** Skeleton for a single channel item (icon + label) */
export function SkChannel() {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5">
      <Sk w="w-4" h="h-4" className="rounded-sm flex-shrink-0" />
      <Sk w="w-28" h="h-3" />
    </div>
  );
}

/** Skeleton for the server name header */
export function SkServerName() {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <Sk w="w-24" h="h-4" />
      <Sk w="w-4" h="h-4" className="rounded-full" />
    </div>
  );
}

/** Skeleton for section title */
export function SkSectionTitle() {
  return (
    <div className="px-4 py-1">
      <Sk w="w-20" h="h-2.5" />
    </div>
  );
}

/** Skeleton for a single message group (avatar + author + 2 lines) */
export function SkMessage({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex gap-4 px-4 py-2">
      <Sk w="w-10" h="h-10" className="rounded-full flex-shrink-0" />
      <div className="flex flex-col gap-2 flex-1 pt-1">
        <div className="flex items-center gap-2">
          <Sk w="w-24" h="h-3" />
          <Sk w="w-12" h="h-2" />
        </div>
        {Array.from({ length: lines }).map((_, i) => (
          <Sk key={i} w={i === lines - 1 ? 'w-3/5' : 'w-full'} h="h-3" />
        ))}
      </div>
    </div>
  );
}

/** Full message list skeleton */
export function SkMessageList() {
  return (
    <div className="flex flex-col gap-1 pt-4 animate-fade-in">
      <SkMessage lines={2} />
      <SkMessage lines={1} />
      <SkMessage lines={3} />
      <SkMessage lines={1} />
      <SkMessage lines={2} />
      <SkMessage lines={1} />
    </div>
  );
}

/** Full channel sidebar skeleton */
export function SkChannelSidebar() {
  return (
    <div className="flex flex-col animate-fade-in">
      <SkServerName />
      <div className="mt-3">
        <SkSectionTitle />
        <SkChannel />
        <SkChannel />
        <SkChannel />
      </div>
      <div className="mt-4">
        <SkSectionTitle />
        <SkChannel />
        <SkChannel />
      </div>
    </div>
  );
}
/** Skeleton for a single DM conversation row (avatar + name + preview) */
export function SkDMConversation() {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <Sk w="w-8" h="h-8" className="rounded-full flex-shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <Sk w="w-24" h="h-3" />
        <Sk w="w-36" h="h-2.5" />
      </div>
    </div>
  );
}

/** Full DM list skeleton */
export function SkDMList() {
  return (
    <div className="flex flex-col animate-fade-in pt-1">
      <SkDMConversation />
      <SkDMConversation />
      <SkDMConversation />
      <SkDMConversation />
    </div>
  );
}
