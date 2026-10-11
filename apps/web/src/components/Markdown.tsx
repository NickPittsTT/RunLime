import ReactMarkdown from 'react-markdown';

/** Renders trusted legal/support markdown. Raw HTML is not allowed (react-markdown default). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-legal">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
