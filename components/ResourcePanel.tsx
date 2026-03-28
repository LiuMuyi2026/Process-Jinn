import React from 'react';
import { Resource } from '../types';
import { Box, Loader2, X } from './Icons';
import { StepRenderer } from './StepRenderer';

interface ResourcePanelProps {
  resource: Resource | null;
  onResourceClick: (name: string) => void;
  onClose: () => void;
  labels: {
    acquisitionPlan: string;
    generating: string;
  }
}

export const ResourcePanel: React.FC<ResourcePanelProps> = ({ resource, onResourceClick, onClose, labels }) => {
  if (!resource) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden h-fit sticky top-24 animate-in slide-in-from-right-8 fade-in duration-300">
      <div className="bg-indigo-50 p-5 border-b border-indigo-100 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 shadow-sm flex items-center justify-center flex-shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-lg text-slate-900 leading-tight truncate">{resource.name}</h2>
            <p className="text-xs font-medium text-indigo-600 mt-1 uppercase tracking-wide">{labels.acquisitionPlan}</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 -mr-2 -mt-2 text-slate-400 hover:text-slate-600 hover:bg-indigo-100/50 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
        {resource.loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span className="text-sm">{labels.generating}</span>
          </div>
        ) : (
          resource.acquisitionSteps && resource.acquisitionSteps.length > 0 ? (
            <div className="space-y-6">
              {resource.acquisitionSteps.map((step, idx) => (
                <div key={step.id} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold font-mono flex items-center justify-center ring-2 ring-white">
                      {idx + 1}
                    </div>
                    {idx !== resource.acquisitionSteps!.length - 1 && (
                      <div className="w-0.5 flex-grow bg-slate-100 my-1 group-hover:bg-indigo-100 transition-colors"></div>
                    )}
                  </div>
                  <div className="pb-2">
                    <div className="text-sm text-slate-700 leading-relaxed">
                      <StepRenderer text={step.instruction} onResourceClick={onResourceClick} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No specific steps found.</p>
          )
        )}
      </div>
    </div>
  );
};