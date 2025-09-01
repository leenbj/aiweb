"use client";

// 轻量化的 Toaster 包装，避免对外部主题/类型的强依赖
// 在缺少 next-themes/sonner 类型或运行时依赖时仍可编译
import { Toaster as Sonner } from "sonner";

// 使用 any 以避免对库类型声明的依赖
const Toaster = ({ ...props }: any) => {
  const theme = "system";

  return (
    // @ts-ignore
    <Sonner
      theme={theme as any}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
