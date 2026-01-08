import React from 'react';
import { Step, PlanItem } from '../types';
import { StepRenderer } from './StepRenderer';
import { Plus, Minus, Loader2, Layers } from './Icons';

interface StepListProps {
  items: PlanItem[]; 
  onExpandStep: (step: Step) => void;
  onResourceClick: (resourceName: string) => void;
  labels: {
    expand: string;
    collapse: string;
    simultaneous: string;
  }
}

interface RecursiveStepProps {
  step: Step;
  index: number;
  depth: number;
  onExpand: (s: Step) => void;
  onResource: (r: string) => void;
  labels: StepListProps['labels'];
  isLast: boolean;
  isParallel?: boolean;
}

const RecursiveStep: React.FC<RecursiveStepProps> = ({ 
  step, 
  index, 
  depth, 
  onExpand, 
  onResource, 
  labels, 
  isLast, 
  isParallel 
}) => {
  const isRoot = depth === 0;

  // Determine container styling based on depth and parallel status
  const containerClasses = isRoot 
    ? (isParallel ? 'flex-col h-full bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-indigo-200 transition-colors' : '') 
    : '';

  const wrapperClasses = `relative ${isRoot ? (isParallel ? 'h-full' : 'pb-8 last:pb-0') : 'pb-4 last:pb-0'}`;

  // Icon sizing and positioning
  const iconSizeClass = isRoot ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-[10px] mt-0.5';
  const linePositionClass = isRoot ? 'top-8 left-4' : 'top-6 left-3';

  return (
    <div className={wrapperClasses}>
      
      {/* Vertical Connector Line */}
      {!isLast && !isParallel && (
        <div className={`absolute ${linePositionClass} w-0.5 h-[calc(100%-8px)] bg-slate-200 -z-10`}></div>
      )}

      <div className={`flex items-start gap-4 group ${containerClasses}`}>
        
        {/* Number Icon (Only show if not parallel root wrapper, or if it is a child) */}
        {(!isParallel || !isRoot) && (
          <div className={`flex-shrink-0 ${iconSizeClass} rounded-full bg-white border-2 border-indigo-100 text-indigo-600 flex items-center justify-center font-bold shadow-sm z-10 group-hover:border-indigo-500 transition-all duration-300`}>
            {index + 1}
          </div>
        )}

        <div className="flex-grow min-w-0">
          <div className={`text-slate-700 leading-relaxed ${isRoot ? 'text-base' : 'text-sm'}`}>
            <StepRenderer text={step.instruction} onResourceClick={onResource} />
          </div>
          
          {/* Action Button */}
          <div className="mt-2">
             <button
               onClick={(e) => {
                 e.stopPropagation();
                 onExpand(step);
               }}
               disabled={step.loading}
               className={`
                 text-xs font-medium px-2.5 py-1 rounded-full transition-all flex items-center gap-1.5 disabled:opacity-50
                 ${step.isExpanded 
                    ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                    : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700'}
               `}
             >
               {step.loading ? (
                 <>
                   <Loader2 className="w-3 h-3 animate-spin" />
                 </>
               ) : step.isExpanded ? (
                 <>
                   <Minus className="w-3 h-3" /> {labels.collapse}
                 </>
               ) : (
                 <>
                   <Plus className="w-3 h-3" /> {labels.expand}
                 </>
               )}
             </button>
          </div>

          {/* Recursive Children Container */}
          {step.isExpanded && step.subSteps && (
            <div className="mt-4 border-l-2 border-indigo-100 pl-4 animate-in fade-in slide-in-from-top-2">
               {step.subSteps.map((sub, i) => (
                 <RecursiveStep 
                    key={sub.id}
                    step={sub}
                    index={i}
                    depth={depth + 1}
                    onExpand={onExpand}
                    onResource={onResource}
                    labels={labels}
                    isLast={i === step.subSteps!.length - 1}
                 />
               ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const StepList: React.FC<StepListProps> = ({ items, onExpandStep, onResourceClick, labels }) => {
  return (
    <div className="relative">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        if (item.type === 'single') {
          return (
            <RecursiveStep 
              key={item.step.id} 
              step={item.step} 
              index={index}
              depth={0}
              onExpand={onExpandStep} 
              onResource={onResourceClick} 
              labels={labels}
              isLast={isLast}
            />
          );
        }

        if (item.type === 'parallel') {
          return (
            <div key={item.group.id} className="relative pb-8 last:pb-0">
               {!isLast && (
                 <div className="absolute top-0 left-4 w-0.5 h-full bg-slate-200 -z-10"></div>
               )}

               <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center shadow-sm z-10">
                    <Layers className="w-4 h-4" />
                  </div>

                  <div className="flex-grow">
                    <div className="mb-3 flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">{labels.simultaneous}</span>
                       <div className="h-px bg-slate-200 flex-grow"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {item.group.steps.map((pStep, pIndex) => (
                        <RecursiveStep
                          key={pStep.id}
                          step={pStep}
                          index={pIndex}
                          depth={0}
                          onExpand={onExpandStep}
                          onResource={onResourceClick}
                          labels={labels}
                          isParallel={true}
                          isLast={true} 
                        />
                      ))}
                    </div>
                  </div>
               </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};