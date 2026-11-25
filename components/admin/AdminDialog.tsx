import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AdminDialogProps {
  open?: boolean;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  error?: string | null;
  loading?: boolean;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export function AdminDialog({
  open,
  isOpen,
  onOpenChange,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  error,
  loading = false,
  onConfirm,
  confirmText = 'Save',
  cancelText = 'Cancel',
  destructive = false,
}: AdminDialogProps) {
  const isDialogOpen = open !== undefined ? open : (isOpen ?? false);
  const handleOpenChange = onOpenChange || ((val: boolean) => {
    if (!val && onClose) onClose();
  });
  const maxWidthClass = {
    sm: 'sm:max-w-[425px]',
    md: 'sm:max-w-[600px]',
    lg: 'sm:max-w-[800px]',
    xl: 'sm:max-w-[1000px]',
    '2xl': 'sm:max-w-[1200px]',
    '3xl': 'sm:max-w-[1400px]',
    '4xl': 'sm:max-w-[1600px]',
    '5xl': 'sm:max-w-[1800px]',
  }[maxWidth];

  return (
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={`bg-card border-border/50 text-foreground ${maxWidthClass} overflow-hidden max-h-[90vh] flex flex-col p-0 gap-0`}>
        <div className="p-6 border-b border-border/50 bg-background/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">{title}</DialogTitle>
            {description && (
              <DialogDescription className="text-muted-foreground mt-1.5">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {error && (
            <Alert variant="destructive" className="mb-4 bg-red-950/50 border-red-900/50 text-red-400">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {children}
        </div>

        {(footer || onConfirm) && (
          <div className="p-4 border-t border-border/50 bg-background/20 flex items-center justify-end gap-3 mt-auto">
            {footer ? (
              footer
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={loading}
                  className="border-border/50 bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  {cancelText}
                </Button>
                {onConfirm && (
                  <Button
                    onClick={onConfirm}
                    disabled={loading}
                    className={
                      destructive
                        ? 'bg-red-600 hover:bg-red-700 text-foreground'
                        : 'bg-blue-600 hover:bg-blue-700 text-foreground'
                    }
                  >
                    {loading ? (
                      <div className="h-4 w-4 border-2 border-border border-t-white rounded-full animate-spin mr-2" />
                    ) : null}
                    {confirmText}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
