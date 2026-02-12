import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AnnotatedImage } from '../services/aiService';

interface ResultDisplayProps {
  result: string;
  annotatedImages?: AnnotatedImage[];
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result, annotatedImages }) => {
  const [expandedImage, setExpandedImage] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* AI-Annotated Images from Gemini 3 Agentic Vision */}
      {annotatedImages && annotatedImages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span className="font-medium">AI Analysis Visualization</span>
          </div>
          <div className={`grid gap-3 ${annotatedImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {annotatedImages.map((img, index) => (
              <button
                key={index}
                onClick={() => setExpandedImage(expandedImage === index ? null : index)}
                className="relative overflow-hidden rounded-xl border-2 border-[var(--color-primary)]/30 hover:border-[var(--color-primary)] transition-all group"
              >
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={img.description || `AI analysis ${index + 1}`}
                  className="w-full h-auto object-contain bg-black"
                  loading="lazy"
                />
                <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-xs text-white text-center">
                    {img.description || 'Tap to expand'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Image Modal */}
      {expandedImage !== null && annotatedImages && annotatedImages[expandedImage] && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
            onClick={() => setExpandedImage(null)}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={`data:${annotatedImages[expandedImage].mimeType};base64,${annotatedImages[expandedImage].data}`}
            alt={annotatedImages[expandedImage].description || 'AI analysis'}
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
          />
        </div>
      )}

      {/* Markdown Content */}
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
    </div>
  );
};

export default ResultDisplay;
