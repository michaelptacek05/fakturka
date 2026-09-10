import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Tlačítka nesou obrys, ne stín. Plocha se odlišuje barvou a rámem, takže
 * karta i tlačítko na ní zůstávají ve stejné výškové rovině.
 */
const buttonVariants = cva(
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-medium transition-[color,background-color,border-color] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-primary bg-primary text-primary-foreground hover:border-primary/85 hover:bg-primary/85",
        outline:
          "border-input bg-card text-foreground hover:border-border hover:bg-accent/50",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
        link: "border-transparent text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground",
        success:
          "border-success bg-success text-success-foreground hover:border-success/85 hover:bg-success/85",
        destructive:
          "border-destructive bg-destructive text-destructive-foreground hover:border-destructive/85 hover:bg-destructive/85",
        /* Pro nevratné akce, které nejsou hlavní akcí stránky — plná červená
           by přebila tlačítko, kterým se ukládá. */
        "destructive-outline":
          "border-destructive/30 bg-card text-destructive hover:border-destructive/45 hover:bg-destructive/8",
      },
      size: {
        default: "px-4",
        sm: "h-9 px-3",
        lg: "h-11 rounded-xl px-6",
        icon: "size-10",
        "icon-sm": "size-9",
      },
    },
    /*
     * Odsazení a výška se ruší až tady: cva vypisuje `compoundVariants` za
     * skupinou `size`, takže `px-4` z velikosti odkazu už nepřebije.
     */
    compoundVariants: [
      {
        className: "h-auto p-0",
        variant: "link",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
