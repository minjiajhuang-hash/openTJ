"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkMath from "remark-math";

export function RichContent({ source, className = "" }: { source: string; className?: string }) {
  return (
    <div className={`long-form ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[[rehypeSanitize, { ...defaultSchema, attributes: { ...defaultSchema.attributes, code: [["className", /^language-./, "math-inline", "math-display"]] } }], [rehypeKatex, { trust: false, strict: "ignore", maxExpand: 100, maxSize: 20, throwOnError: false }]]} skipHtml>
        {source.slice(0, 30000)}
      </ReactMarkdown>
    </div>
  );
}
