import React, { useState } from 'react';
import { Step, PlanItem } from '../types';
import { StepRenderer } from './StepRenderer';
import { Plus, Minus, Loader2, Layers, CheckCircle2, Circle, Edit3, RefreshCw, Save, X } from './Icons';

interface StepListProps {
  items: PlanItem[]; 
  onExpandStep: (step: Step) => void;
  onResourceClick: (resourceName: string) => void;
  onToggleComplete: (step: Step) => void;
  onEditStep: (step: Step, newText: string, mode: 'save' | 'substeps' | 'future') => void;
  onRegenerateStep: (step: Step) => void;
  labels: {
    expand: string;
    collapse: string;
    simultaneous: string;
    edit: string;
    regenerate: string;
    save: string;
    cancel: string;
    postEditTitle: string;
    actionJustSave: string;
    actionSubsteps: string;
    actionFuture: string;
  }
}

interface RecursiveStepProps {
  step: Step;
  index: number;
  depth: number;
  onExpand: (s: Step) => void;
  onResource: (r: string) => void;
  onComplete: (s: Step) => void;
  onEdit: (s: Step, txt: string, mode: 'save' | 'substeps' | 'future') => void;
  onRegenerate: (s: Step) => void;
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
  onComplete,
  onEdit,
  onRegenerate,
  labels, 
  isLast, 
  isParallel 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(step.instruction);
  const [showPostEditOptions, setShowPostEditOptions] = useState(false);

  const isRoot = depth === 0;

  // Determine container styling based on depth and parallel status
  const containerClasses = isRoot 
    ? (isParallel ? 'flex-col h-full bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-indigo-200 transition-colors' : '') 
    : '';

  const wrapperClasses = `relative ${isRoot ? (isParallel ? 'h-full' : 'pb-8 last:pb-0') : 'pb-4 last:pb-0'}`;

  // Icon sizing and positioning
  const iconSizeClass = isRoot ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-[10px] mt-0.5';
  const linePositionClass = isRoot ? 'top-8 left-4' : 'top-6 left-3';

  const handleStartEdit = () => {
    setEditText(step.instruction);
    setIsEditing(true);
    setShowPostEditOptions(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setShowPostEditOptions(false);
    setEditText(step.instruction);
  };

  const handlePreSave = () => {
    // If text didn't change significantly, just save.
    if (editText.trim() === step.instruction.trim()) {
      setIsEditing(false);
      return;
    }
    setShowPostEditOptions(true);
  };

  const handleConfirmAction = (mode: 'save' | 'substeps' | 'future') => {
    onEdit(step, editText, mode);
    setIsEditing(false);
    setShowPostEditOptions(false);
  };

  return (
    <div className={wrapperClasses}>
      
      {/* Vertical Connector Line */}
      {!isLast && !isParallel && (
        <div className={`absolute ${linePositionClass} w-0.5 h-[calc(100%-8px)] bg-slate-200 -z-10`}></div>
      )}

      <div className={`flex items-start gap-4 group ${containerClasses}`}>
        
        {/* Number/Check Icon */}
        <div className="relative">
          <button 
            onClick={() => onComplete(step)}
            className={`
              flex-shrink-0 ${iconSizeClass} rounded-full flex items-center justify-center font-bold shadow-sm z-10 transition-all duration-300
              ${step.isCompleted 
                ? 'bg-green-100 border-2 border-green-500 text-green-600' 
                : (!isParallel || !isRoot) ? 'bg-white border-2 border-indigo-100 text-indigo-600 group-hover:border-indigo-500' : ''}
              ${(isParallel && isRoot && !step.isCompleted) ? 'hidden' : ''} 
            `}
          >
            {step.isCompleted ? <CheckCircle2 className="w-full h-full p-1" /> : (index + 1)}
          </button>
        </div>

        <div className="flex-grow min-w-0">
          
          {/* Content Area */}
          <div className="group/content relative">
            {isEditing ? (
               <div className="space-y-3 bg-white p-3 rounded-xl border-2 border-indigo-100 shadow-sm animate-in zoom-in-95 duration-200">
                 {showPostEditOptions ? (
                   <div className="text-center space-y-3 py-1">
                      <p className="text-sm font-semibold text-slate-800">{labels.postEditTitle}</p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        <button 
                          onClick={() => handleConfirmAction('save')}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          {labels.actionJustSave}
                        </button>
                        <button 
                           onClick={() => handleConfirmAction('substeps')}
                           className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-medium transition-colors border border-indigo-200"
                        >
                           {labels.actionSubsteps}
                        </button>
                        {/* Only show future updates for root steps to avoid extreme complexity */}
                        {isRoot && (
                          <button 
                             onClick={() => handleConfirmAction('future')}
                             className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium transition-colors border border-amber-200"
                          >
                             {labels.actionFuture}
                          </button>
                        )}
                      </div>
                      <button onClick={() => setShowPostEditOptions(false)} className="text-xs text-slate-400 hover:text-slate-600 underline decoration-dotted">Back</button>
                   </div>
                 ) : (
                    <>
                      <textarea 
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full p-2 text-sm text-slate-700 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none bg-slate-50"
                        rows={3}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={handleCancelEdit} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors" title={labels.cancel}>
                          <X className="w-4 h-4" />
                        </button>
                        <button onClick={handlePreSave} className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors" title={labels.save}>
                          <Save className="w-4 h-4" />
                        </button>
                      </div>
                    </>
                 )}
               </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                 <div className={`text-slate-700 leading-relaxed ${isRoot ? 'text-base' : 'text-sm'} ${step.isCompleted ? 'line-through text-slate-400 decoration-slate-300' : ''}`}>
                   <StepRenderer text={step.instruction} onResourceClick={onResource} />
                 </div>
                 
                 {/* Hover Actions */}
                 <div className="flex items-center gap-1 opacity-0 group-hover/content:opacity-100 transition-opacity">
                    <button 
                      onClick={handleStartEdit}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title={labels.edit}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => onRegenerate(step)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title={labels.regenerate}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${step.loading ? 'animate-spin' : ''}`} />
                    </button>
                 </div>
              </div>
            )}
          </div>
          
          {/* Expansion Toggle Button */}
          {!isEditing && (
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
          )}

          {/* Recursive Children Container */}
          {step.isExpanded && step.subSteps && !isEditing && (
            <div className="mt-4 border-l-2 border-indigo-100 pl-4 animate-in fade-in slide-in-from-top-2">
               {step.subSteps.map((sub, i) => (
                 <RecursiveStep 
                    key={sub.id}
                    step={sub}
                    index={i}
                    depth={depth + 1}
                    onExpand={onExpand}
                    onResource={onResource}
                    onComplete={onComplete}
                    onEdit={onEdit}
                    onRegenerate={onRegenerate}
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

export const StepList: React.FC<StepListProps> = ({ 
  items, 
  onExpandStep, 
  onResourceClick, 
  onToggleComplete, 
  onEditStep,
  onRegenerateStep,
  labels 
}) => {
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
              onComplete={onToggleComplete}
              onEdit={onEditStep}
              onRegenerate={onRegenerateStep}
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
                          onComplete={onToggleComplete}
                          onEdit={onEditStep}
                          onRegenerate={onRegenerateStep}
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
