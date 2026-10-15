import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Renders trusted legal/support markdown, including GitHub-style tables. Raw HTML is not allowed (react-markdown default). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-legal">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
