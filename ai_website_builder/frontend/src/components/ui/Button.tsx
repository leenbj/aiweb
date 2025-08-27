import { ButtonHTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'
import { LoadingSpinner } from './LoadingSpinner'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    className, 
    children, 
    disabled,
    ...props 
  }, ref) => {
    const baseClasses = 'btn'
    const variantClasses = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      success: 'btn-success',
      warning: 'btn-warning',
      error: 'btn-error',
      ghost: 'btn-ghost'
    }
    const sizeClasses = {
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg'
    }

    return (
      <button
        ref={ref}
        className={clsx(
          baseClasses,
          variantClasses[variant],
          sizeClasses[size],
          loading && 'cursor-not-allowed',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <LoadingSpinner 
            size="sm" 
            color={variant === 'primary' ? 'white' : 'gray'}
            className="mr-2" 
          />
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'