"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
import { User, Bot, Crown, Sparkles } from 'lucide-react';

interface AvatarProps extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  variant?: 'default' | 'user' | 'ai' | 'premium';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  status?: 'online' | 'offline' | 'busy';
}

const avatarSizes = {
  sm: "size-6",
  md: "size-8", 
  lg: "size-10",
  xl: "size-12"
};

const avatarVariants = {
  default: "bg-muted",
  user: "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground",
  ai: "bg-gradient-to-br from-gray-700 to-gray-900 text-white",
  premium: "bg-gradient-to-br from-primary to-gray-800 text-primary-foreground"
};

const statusColors = {
  online: "bg-green-500",
  offline: "bg-gray-500", 
  busy: "bg-gray-600"
};

function Avatar({
  className,
  variant = 'default',
  size = 'lg',
  showStatus = false,
  status = 'offline',
  ...props
}: AvatarProps) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full border-2 border-border/10 shadow-sm",
        avatarSizes[size],
        className,
      )}
      {...props}
    >
      {showStatus && (
        <div 
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background/80",
            statusColors[status]
          )}
        />
      )}
    </AvatarPrimitive.Root>
  );
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  );
}

interface AvatarFallbackProps extends React.ComponentProps<typeof AvatarPrimitive.Fallback> {
  variant?: 'default' | 'user' | 'ai' | 'premium';
}

function AvatarFallback({
  className,
  variant = 'default',
  children,
  ...props
}: AvatarFallbackProps) {
  const getDefaultIcon = () => {
    switch (variant) {
      case 'ai':
        return <Bot className="size-4" />;
      case 'premium':
        return <Crown className="size-4" />;
      case 'user':
        return children || <User className="size-4" />;
      default:
        return children || <User className="size-4" />;
    }
  };

  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-full font-medium text-sm",
        avatarVariants[variant],
        className,
      )}
      {...props}
    >
      {getDefaultIcon()}
    </AvatarPrimitive.Fallback>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
