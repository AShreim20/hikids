import * as React from "react"

import { cn } from "@/lib/utils"
import { isLtrInputType } from "@/lib/textDirection"

const Input = React.forwardRef(({ className, type, dir, ...props }, ref) => {
  return (
    (<input
      type={type}
      // English/numeric-only field types must not inherit the page's RTL
      // direction in Arabic. An explicit `dir` from the caller always wins.
      dir={dir ?? (isLtrInputType(type) ? 'ltr' : undefined)}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
