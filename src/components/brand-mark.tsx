import type { SVGProps } from "react";

export function BrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      className={`brand-mark ${props.className ?? ""}`}
      viewBox="0 0 40 40"
      {...props}
    >
      <path d="M5 8.2 20 2l15 6.2v6.1L20 20.5 5 14.3V8.2Zm4 8.6 11 4.5 11-4.5v7.4l-11 4.5-11-4.5v-7.4Zm5 10.7 6 2.5 6-2.5v5.2L20 38l-6-5.3v-5.2Z" />
    </svg>
  );
}
