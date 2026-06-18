'use client'
import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
}

export function Modal({ open, onClose, title, description, children }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => { document.body.style.overflow = 'unset' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-fade-in">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className="relative bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-line flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between px-6 py-5 border-b border-line bg-surface/30">
            <div>
              {title && <h3 className="font-display font-bold text-lg text-ink leading-tight">{title}</h3>}
              {description && <p className="text-xs text-ink4 mt-1">{description}</p>}
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-ink4 hover:bg-ink/5 hover:text-ink transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  )
}
