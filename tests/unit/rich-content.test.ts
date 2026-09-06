import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RichContent } from "@/components/rich-content";

const render = (source: string) => renderToStaticMarkup(createElement(RichContent, { source }));

describe("student-authored rich content", () => {
  it("preserves real KaTeX output after sanitization", () => {
    const html = render("A sum $x^2 + 1$.\n\n$$\n\\sum_{k=1}^n k\n$$");
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain("<math");
  });
  it("does not render raw HTML or executable Markdown links", () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert%281%29)');
    expect(html).not.toMatch(/<script|<img|onerror=|href="javascript:/i);
  });
  it("disables trusted TeX links and injected HTML", () => {
    const html = render('$\\href{javascript:alert(1)}{click}$ $\\htmlClass{evil}{x}$');
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('class="evil"');
  });
});
