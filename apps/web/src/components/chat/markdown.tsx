import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';

const remarkPlugins = [remarkGfm];

function MarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href) return <>{children}</>;
  if (/^https?:\/\//i.test(href)) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-hover)]"
      >
        {children}
      </a>
    );
  }
  // A single leading slash only: `//host` and `/\host` resolve to another origin.
  if (/^\/(?![/\\])/.test(href)) {
    return (
      <Link to={href} className="text-[var(--accent)] underline underline-offset-2 hover:text-[var(--accent-hover)]">
        {children}
      </Link>
    );
  }
  // mailto:, javascript:, relative paths, ...: keep the text, drop the link.
  return <>{children}</>;
}

type Props<T extends keyof JSX.IntrinsicElements> = ComponentPropsWithoutRef<T> & { node?: unknown };

/** Strips react-markdown's `node` prop so it is not spread onto DOM elements. */
function el<T extends keyof JSX.IntrinsicElements>(tag: T, className: string) {
  const Tag = tag as 'div';
  return function MarkdownElement({ node: _node, ...props }: Props<T>) {
    return <Tag {...(props as ComponentPropsWithoutRef<'div'>)} className={className} />;
  };
}

const components: Components = {
  p: el('p', 'my-2 first:mt-0 last:mb-0 leading-relaxed'),
  h1: el('h1', 'text-sm font-semibold mt-3 mb-1 first:mt-0'),
  h2: el('h2', 'text-sm font-semibold mt-3 mb-1 first:mt-0'),
  h3: el('h3', 'text-[13px] font-semibold mt-2 mb-1 first:mt-0'),
  h4: el('h4', 'text-[13px] font-semibold mt-2 mb-1 first:mt-0'),
  ul: el('ul', 'my-2 pl-5 list-disc space-y-1'),
  ol: el('ol', 'my-2 pl-5 list-decimal space-y-1'),
  li: el('li', 'leading-relaxed'),
  strong: el('strong', 'font-semibold'),
  em: el('em', 'italic'),
  a: ({ href, children }) => <MarkdownLink href={href}>{children}</MarkdownLink>,
  code: ({ node: _node, className, children, ...props }) => {
    // Fenced blocks arrive as <pre><code class="language-x">; keep those unpadded.
    const inBlock = typeof className === 'string' && className.includes('language-');
    return (
      <code
        {...props}
        className={inBlock ? 'font-mono' : 'font-mono text-[12px] px-1 rounded bg-[var(--surface-2)]'}
      >
        {children}
      </code>
    );
  },
  pre: el('pre', 'my-2 overflow-x-auto rounded border border-[var(--border)] bg-[var(--surface-2)] p-2 text-[12px] font-mono'),
  blockquote: el('blockquote', 'my-2 border-l-2 border-[var(--border)] pl-3 text-[var(--text-secondary)]'),
  hr: el('hr', 'my-3 border-[var(--border)]'),
  table: ({ node: _node, ...props }) => (
    <div className="my-2 overflow-x-auto">
      <table {...props} className="w-full text-[13px]" />
    </div>
  ),
  th: el('th', 'font-mono text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] text-left pb-1 pr-3 border-b border-[var(--border)]'),
  td: el('td', 'py-1 pr-3 align-top border-b border-[var(--border)]'),
  img: () => null,
};

/** Renders assistant markdown (GFM) with the app's tokens. HTML is skipped, images are dropped. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm text-[var(--text)] break-words">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components} skipHtml>
        {text}
      </ReactMarkdown>
    </div>
  );
}
