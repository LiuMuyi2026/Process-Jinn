import React from 'react';
import { Resource, Step } from '../types';
import { Box, ChevronDown, ChevronRight, Loader2 } from './Icons';
import { StepRenderer } from './StepRenderer';

interface ResourceTabProps {
  resources: Resource[];
  onExpandResource: (resourceId: string, resourceName: string) => void;
  onResourceClick: (name: string) => void; // For recursive resource clicking if needed
}

export const ResourceTab: React.FC<ResourceTabProps> = ({ resources, onExpandResource, onResourceClick }) => {
  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Box className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg">No resources identified yet.</p>
        <p className="text-sm">Generate strategies to find needed tools.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 mb-6 flex items-center gap-2">
        <Box className="w-6 h-6 text-blue-500" />
        Acquisition Plans
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resources.map((resource) => (
          <div key={resource.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div 
              className="p-4 flex items-center justify-between cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
              onClick={() => onExpandResource(resource.id, resource.name)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Box className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-800">{resource.name}</h3>
              </div>
              <div className="text-slate-400">
                {resource.loading ? (
                   <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                ) : resource.isExpanded ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </div>
            </div>
            
            {resource.isExpanded && resource.acquisitionSteps && (
              <div className="p-4 border-t border-slate-100 bg-white">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">How to acquire</h4>
                <ul className="space-y-3">
                  {resource.acquisitionSteps.map((step, idx) => (
                    <li key={step.id} className="flex gap-3 text-sm text-slate-600">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-mono">
                        {idx + 1}
                      </span>
                      <div className="leading-relaxed">
                         <StepRenderer text={step.instruction} onResourceClick={onResourceClick} />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};