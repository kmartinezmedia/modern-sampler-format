"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo } from "react";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  // Memoize components to ensure consistent rendering
  const components = useMemo(
    () => ({
      pre: ({ children, className, ...props }: React.ComponentPropsWithoutRef<"pre">) => {
        // Remove tabindex, node, and other problematic attributes
        const { tabIndex, tabindex, node, ...restProps } = props as Record<string, unknown>;
        // Preserve the original className from react-markdown exactly as-is
        return (
          <pre className={className} {...restProps}>
            {children}
          </pre>
        );
      },
      code: ({ children, className, ...props }: React.ComponentPropsWithoutRef<"code">) => {
        // Remove tabindex, node, and other problematic attributes
        const { tabIndex, tabindex, node, ...restProps } = props as Record<string, unknown>;
        // Preserve the original className from react-markdown exactly as-is
        return (
          <code className={className} {...restProps}>
            {children}
          </code>
        );
      },
    }),
    []
  );

  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

