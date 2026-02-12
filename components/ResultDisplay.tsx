import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ResultDisplayProps {
  result: string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 text-base leading-relaxed animate-fade-in overflow-x-auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h3: ({ node, ...props }) => <h3 className="text-2xl font-bold mt-6 mb-3 text-[var(--color-primary)] uppercase italic" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />,
          p: ({ node, ...props }) => <p className="mb-4 text-gray-300" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-2 text-gray-300" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-2 text-gray-300" {...props} />,
          li: ({ node, ...props }) => <li className="" {...props} />,
          strong: ({ node, ...props }) => <strong className="text-white font-bold" {...props} />,
          hr: ({ node, ...props }) => <hr className="my-6 border-gray-800" {...props} />,
          table: ({ node, ...props }) => <table className="w-full my-6 text-left border-collapse" {...props} />,
          thead: ({ node, ...props }) => <thead className="bg-white/5" {...props} />,
          th: ({ node, ...props }) => <th className="p-3 border-b border-gray-700 font-bold text-[var(--color-primary)] uppercase text-sm" {...props} />,
          td: ({ node, ...props }) => <td className="p-3 border-b border-gray-800 text-gray-300" {...props} />,
        }}
      >
        {result}
      </ReactMarkdown>
    </div>
  );
};

export default ResultDisplay;
