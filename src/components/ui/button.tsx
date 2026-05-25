import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-sans font-medium transition-all duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sapphire-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-sapphire-950 disabled:pointer-events-none disabled:opacity-30',
  {
    variants: {
      variant: {
        primary:
          'bg-sapphire-500 text-sapphire-50 shadow-[0_0_12px_rgba(62,102,176,0.35)] hover:bg-sapphire-400 hover:shadow-[0_0_18px_rgba(62,102,176,0.5)] active:bg-sapphire-600 active:shadow-[0_0_8px_rgba(62,102,176,0.25)]',
        destructive:
          'border border-danger-500/50 text-danger-500 bg-transparent hover:bg-danger-500/10 hover:border-danger-500/80',
        outline:
          'border border-sapphire-400/50 text-sapphire-200 bg-transparent hover:border-sapphire-300 hover:text-sapphire-50 hover:bg-sapphire-800/40',
        secondary:
          'bg-sapphire-800 text-sapphire-200 border border-sapphire-700/60 hover:bg-sapphire-700 hover:text-sapphire-50 hover:border-sapphire-500/60',
        ghost:
          'text-ink-300 hover:text-sapphire-100 hover:bg-sapphire-900/50',
        link: 'text-sapphire-300 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-6 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
