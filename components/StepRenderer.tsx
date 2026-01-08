import React from 'react';
import { Box } from './Icons';

interface StepRendererProps {
  text: string;
  onResourceClick: (resourceName: string) => void;
  className?: string;
}

export const StepRenderer: React.FC<StepRendererProps> = ({ text, onResourceClick, className = "" }) => {
  // Regex to match [Resource Name]
  const parts = text.split(/(\[[^\]]+\])/g);

  return (
    <span className={`leading-relaxed ${className}`}>
      {parts.map((part, index) => {
        if (part.startsWith('[') && part.endsWith(']')) {
          const resourceName = part.slice(1, -1);
          return (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onResourceClick(resourceName);
              }}
              className="group/res inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200 transition-all text-sm font-medium cursor-pointer align-baseline transform hover:scale-105 hover:shadow-sm"
              title="View acquisition plan"
            >
              <Box className="w-3 h-3 opacity-50 group-hover/res:opacity-100 transition-opacity" />
              {resourceName}
            </button>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};