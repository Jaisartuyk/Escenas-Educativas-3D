'use client'
import React from 'react'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  isLoading?: boolean
  leftIcon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading,
  leftIcon,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all rounded-xl disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variants = {
    primary: 'bg-violet text-white hover:bg-violet2 shadow-sm',
    outline: 'border border-line bg-white text-ink hover:border-violet hover:text-violet',
    ghost: 'text-ink3 hover:bg-violet/5 hover:text-violet',
    danger: 'bg-rose-500 text-white hover:bg-rose-600',
  }

  const sizes = {
    xs: 'px-2.5 py-1.5 text-[10px]',
    sm: 'px-3 py-2 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
      {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
    </button>
  )
}
