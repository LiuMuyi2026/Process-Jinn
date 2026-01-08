import React from 'react';
import { Resource } from '../types';
import { Box, Loader2 } from './Icons';
import { StepRenderer } from './StepRenderer';

interface ResourcePanelProps {
  resource: Resource | null;
  onResourceClick: (name: string) => void;
  labels: {
    noResourceTitle: string;
    noResourceDesc: string;
    acquisitionPlan: string;
    generating: string;
    noSteps?: string;
  }
}

export const ResourcePanel: React.FC<ResourcePanelProps> = ({ resource, onResourceClick, labels }) => {
  if (!resource) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center h-fit sticky top-24">
        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
           <Box className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-500">{labels.noResourceTitle}</h3>
        <p className="text-sm text-slate-400 mt-2">
          {labels.noResourceDesc}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit sticky top-24 animate-in slide-in-from-right-4 duration-500">
      <div className="bg-indigo-50 p-6 border-b border-indigo-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-white text-indigo-600 shadow-sm flex items-center justify-center flex-shrink-0">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-lg text-slate-900 leading-tight">{resource.name}</h2>
            <p className="text-xs font-medium text-indigo-600 mt-1 uppercase tracking-wide">{labels.acquisitionPlan}</p>
          </div>
        </div>
      </div>

      <div className="p-6">
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
