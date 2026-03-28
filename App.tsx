import React, { useState, useRef, useEffect } from 'react';
import { generateStrategies, expandStep, generateResourcePlan, generateStrategyPlan, regenerateStepText, regenerateFutureSteps } from './services/geminiService';
import { GoalState, Step, Resource, PlanItem, Strategy, Language } from './types';
import { Wand2, Layers, Loader2, ArrowRight, ArrowLeft, Copy, Download, Check } from './components/Icons';
import { StepList } from './components/StepList';
import { ResourcePanel } from './components/ResourcePanel';
import { getTranslation } from './translations';

const App: React.FC = () => {
  const [state, setState] = useState<GoalState>({
    description: '',
    quantification: '',
    environment: '',
    strategies: [],
    resources: [],
    selectedResourceId: null,
    selectedStrategyId: null,
    stage: 'INPUT',
    loading: false,
    error: null,
    language: 'en'
  });

  const [copied, setCopied] = useState(false);

  const t = getTranslation(state.language);

  const LOADING_MESSAGES = [
    t.loadingAnalyzing,
    t.loadingThinking,
    t.loadingStrategies,
    t.loadingResources,
    t.loadingFinalizing
  ];

  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  // Loading message cycler
  useEffect(() => {
    let interval: any;
    if (state.loading) {
      setLoadingMsgIndex(0);
      interval = setInterval(() => {
        setLoadingMsgIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [state.loading, state.language]); // Reset when language changes

  // Scroll to top on stage change
  useEffect(() => {
    if (state.stage === 'SELECTION' || state.stage === 'PROCESS') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [state.stage]);

  // --- Handlers ---

  const handleGenerate = async () => {
    if (!state.description.trim()) return;

    setState(prev => ({ 
      ...prev, 
      loading: true, 
      stage: 'PROCESSING',
      error: null, 
      strategies: [], 
      resources: [],
      selectedResourceId: null,
      selectedStrategyId: null
    }));
    
    try {
      const strategies = await generateStrategies(state.description, state.quantification, state.environment, state.language);
      
      setState(prev => ({
        ...prev,
        loading: false,
        stage: 'SELECTION',
        strategies,
        resources: [], // Resources are now found when plan is generated
      }));

    } catch (err) {
      console.error(err);
      setState(prev => ({
        ...prev,
        loading: false,
        stage: 'INPUT',
        error: t.errorGeneric
      }));
    }
  };

  const handleSelectStrategy = async (strategyId: string) => {
    const strategy = state.strategies.find(s => s.id === strategyId);
    if (!strategy) return;

    // Lazy load the plan if it doesn't exist OR if language has changed
    if (!strategy.plan || strategy.plan.length === 0 || strategy.planLanguage !== state.language) {
       setState(prev => ({ ...prev, loading: true, stage: 'PROCESSING' })); // Reuse processing screen briefly
       
       try {
         const plan = await generateStrategyPlan(strategy, state.description, state.environment, state.language);
         
         const newResources = extractResourcesFromPlan(plan);
         
         setState(prev => ({
           ...prev,
           loading: false,
           stage: 'PROCESS',
           selectedStrategyId: strategyId,
           resources: newResources,
           strategies: prev.strategies.map(s => s.id === strategyId ? { ...s, plan, planLanguage: state.language } : s)
         }));

       } catch (err) {
         console.error(err);
         setState(prev => ({
           ...prev,
           loading: false,
           stage: 'SELECTION',
           error: t.errorGeneric
         }));
       }

    } else {
      // Plan already exists and matches language
      setState(prev => ({
        ...prev,
        selectedStrategyId: strategyId,
        stage: 'PROCESS'
      }));
    }
  };

  const extractResourcesFromPlan = (plan: PlanItem[], existingResources: Resource[] = []): Resource[] => {
      const newResources: Resource[] = [...existingResources];
      const seenResources = new Set<string>(existingResources.map(r => r.name.toLowerCase()));

      const addResource = (resName: string) => {
        const cleanName = resName.replace(/[\[\]]/g, '').trim(); 
        if (cleanName && !seenResources.has(cleanName.toLowerCase())) {
          seenResources.add(cleanName.toLowerCase());
          newResources.push({
            id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: cleanName,
            isExpanded: false,
            language: state.language
          });
        }
      };

      plan.forEach(item => {
        if (item.type === 'single') {
          item.step.resources.forEach(addResource);
        } else {
          item.group.steps.forEach(s => s.resources.forEach(addResource));
        }
      });
      return newResources;
  };

  const handleReset = () => {
    setState(prev => ({
      ...prev,
      stage: 'INPUT',
      strategies: [],
      resources: [],
      description: '',
      quantification: '',
      environment: ''
    }));
  };

  const handleBackToSelection = () => {
    setState(prev => ({
      ...prev,
      stage: 'SELECTION',
      selectedStrategyId: null
    }));
  };

  // --- New Handlers for Edit/Check/Regenerate ---

  const handleToggleComplete = (step: Step) => {
     updateStepInState(step.id, { isCompleted: !step.isCompleted });
  };

  const handleRegenerateStep = async (step: Step) => {
     updateStepInState(step.id, { loading: true });
     try {
       const context = `${state.description} ${state.environment}`;
       const result = await regenerateStepText(step.instruction, context, state.language);
       
       updateStepInState(step.id, { 
         loading: false, 
         instruction: result.instruction,
         resources: result.resources,
         subSteps: undefined, // Clear old substeps
         isExpanded: false
       });
       
       // Add new resources if found
       if (result.resources.length > 0) {
          setState(prev => ({
             ...prev,
             resources: extractResourcesFromPlan([{type: 'single', step: { ...step, resources: result.resources }}], prev.resources)
          }));
       }
     } catch(e) {
       console.error(e);
       updateStepInState(step.id, { loading: false });
     }
  };

  const handleEditStep = async (step: Step, newText: string, mode: 'save' | 'substeps' | 'future') => {
      // 1. Update the text immediately
      // Extract pseudo-resources from bracketed text
      const regex = /\[(.*?)\]/g;
      const foundResources = [];
      let match;
      while ((match = regex.exec(newText)) !== null) {
         foundResources.push(match[1]);
      }

      updateStepInState(step.id, { 
          instruction: newText, 
          resources: foundResources
      });

      // Update global resources list
      if (foundResources.length > 0) {
        setState(prev => ({
            ...prev,
            resources: extractResourcesFromPlan([{type: 'single', step: { ...step, resources: foundResources }}], prev.resources)
         }));
      }

      // 2. Handle specific modes
      if (mode === 'substeps') {
          // Trigger expand
          const activeStrategy = state.strategies.find(s => s.id === state.selectedStrategyId);
          if (activeStrategy) {
              performExpandStep({ ...step, instruction: newText }, activeStrategy.title);
          }
      } else if (mode === 'future') {
          handleRegenerateFuture(step.id, newText);
      }
  };

  const handleRegenerateFuture = async (stepId: string, currentText: string) => {
      const activeStrategy = state.strategies.find(s => s.id === state.selectedStrategyId);
      if (!activeStrategy || !activeStrategy.plan) return;

      // Find index of the edited step
      const planIndex = activeStrategy.plan.findIndex(item => 
          item.type === 'single' ? item.step.id === stepId : item.group.steps.some(s => s.id === stepId)
      );

      if (planIndex === -1 || planIndex === activeStrategy.plan.length - 1) return; // Not found or last step

      const itemsToRegenerateCount = activeStrategy.plan.length - 1 - planIndex;
      const contextSteps = activeStrategy.plan.slice(0, planIndex + 1).map(item => {
         if (item.type === 'single') return item.step.instruction;
         return item.group.steps.map(s => s.instruction).join(" AND ");
      });
      
      // Show loading on subsequent steps
      const updatedPlanLoading = activeStrategy.plan.map((item, idx) => {
          if (idx > planIndex) {
             if (item.type === 'single') return { ...item, step: { ...item.step, loading: true }};
             // Simplified: parallel groups loading
             return item;
          }
          return item;
      });
      
      setState(prev => ({
        ...prev,
        strategies: prev.strategies.map(s => s.id === state.selectedStrategyId ? { ...s, plan: updatedPlanLoading } : s)
      }));

      try {
         const newFutureItems = await regenerateFutureSteps(state.description, contextSteps, currentText, itemsToRegenerateCount, state.language);
         
         const finalPlan = [...activeStrategy.plan.slice(0, planIndex + 1), ...newFutureItems];
         
         setState(prev => ({
            ...prev,
            strategies: prev.strategies.map(s => s.id === state.selectedStrategyId ? { ...s, plan: finalPlan } : s),
            resources: extractResourcesFromPlan(newFutureItems, prev.resources)
         }));

      } catch(e) {
          console.error(e);
          // Revert loading state
          setState(prev => ({
             ...prev,
             strategies: prev.strategies.map(s => s.id === state.selectedStrategyId ? { ...s, plan: activeStrategy.plan } : s)
          }));
      }
  };

  const handleExpandStep = async (targetStep: Step, contextStrategyTitle: string) => {
    if (targetStep.subSteps && targetStep.subSteps.length > 0) {
      updateStepInState(targetStep.id, { isExpanded: !targetStep.isExpanded });
      return;
    }
    performExpandStep(targetStep, contextStrategyTitle);
  };

  const performExpandStep = async (targetStep: Step, contextStrategyTitle: string) => {
    updateStepInState(targetStep.id, { loading: true });

    try {
      const envContext = state.environment ? ` [Environment: ${state.environment}]` : '';
      const context = `${state.description}${envContext} (Strategy: ${contextStrategyTitle})`;
      const subSteps = await expandStep(targetStep.instruction, context, state.language);
      
      // Update resources
      let updatedResources = [...state.resources];
      const seen = new Set(updatedResources.map(r => r.name.toLowerCase()));
      subSteps.forEach(s => {
          s.resources.forEach(r => {
            const clean = r.replace(/[\[\]]/g, '').trim();
            if (clean && !seen.has(clean.toLowerCase())) {
                seen.add(clean.toLowerCase());
                updatedResources.push({
                    id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: clean,
                    isExpanded: false,
                    language: state.language
                });
            }
          });
      });

      setState(prev => ({
        ...prev,
        resources: updatedResources
      }));

      updateStepInState(targetStep.id, {
        loading: false,
        isExpanded: true,
        subSteps
      });
    } catch (err) {
      console.error(err);
      updateStepInState(targetStep.id, { loading: false });
    }
  };

  const handleResourceClick = (resourceName: string) => {
    const cleanName = resourceName.replace(/[\[\]]/g, '').trim();
    const existing = state.resources.find(r => r.name.toLowerCase() === cleanName.toLowerCase());

    if (existing) {
      setState(prev => ({ ...prev, selectedResourceId: existing.id }));
      // If acquisition steps missing OR language mismatch, fetch
      if (!existing.acquisitionSteps || existing.language !== state.language) {
        handleFetchResourcePlan(existing.id, existing.name);
      }
    } else {
      const newRes: Resource = {
         id: `res-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
         name: cleanName,
         isExpanded: true,
         loading: true,
         language: state.language
      };
      
      setState(prev => ({
        ...prev,
        resources: [newRes, ...prev.resources],
        selectedResourceId: newRes.id
      }));

      generateResourcePlan(cleanName, state.language).then(steps => {
        updateResourceInState(newRes.id, { loading: false, acquisitionSteps: steps, language: state.language });
      });
    }
  };

  const handleFetchResourcePlan = async (resourceId: string, resourceName: string) => {
    updateResourceInState(resourceId, { loading: true });
    try {
      const steps = await generateResourcePlan(resourceName, state.language);
      updateResourceInState(resourceId, { loading: false, acquisitionSteps: steps, language: state.language });
    } catch (e) {
      updateResourceInState(resourceId, { loading: false });
    }
  };

  const updateStepInState = (stepId: string, updates: Partial<Step>) => {
    setState(prev => {
      const newStrategies = prev.strategies.map(strat => {
        if (!strat.plan) return strat;
        
        const processSteps = (steps: Step[]): Step[] => {
          return steps.map(step => {
            if (step.id === stepId) return { ...step, ...updates };
            if (step.subSteps) return { ...step, subSteps: processSteps(step.subSteps) };
            return step;
          });
        };

        const newPlan = strat.plan.map((item): PlanItem => {
          if (item.type === 'single') {
             if (item.step.id === stepId) {
                return { ...item, step: { ...item.step, ...updates } };
             }
             if (item.step.subSteps) {
                return { ...item, step: { ...item.step, subSteps: processSteps(item.step.subSteps) } };
             }
             return item;
          } else {
             const updatedGroupSteps = processSteps(item.group.steps);
             return { ...item, group: { ...item.group, steps: updatedGroupSteps } };
          }
        });

        return { ...strat, plan: newPlan };
      });
      return { ...prev, strategies: newStrategies };
    });
  };

  const updateResourceInState = (resId: string, updates: Partial<Resource>) => {
    setState(prev => ({
      ...prev,
      resources: prev.resources.map(r => r.id === resId ? { ...r, ...updates } : r)
    }));
  };

  const toggleLanguage = () => {
    setState(prev => ({
      ...prev,
      language: prev.language === 'en' ? 'zh' : 'en',
      error: null
    }));
  };

  const generatePlainText = () => {
    if (!activeStrategy) return '';
    
    let text = `${t.appTitle} Plan\n\n`;
    text += `${t.labelGoal}: ${state.description}\n`;
    if (state.quantification) text += `${t.labelSpecifics}: ${state.quantification}\n`;
    if (state.environment) text += `${t.labelEnvironment}: ${state.environment}\n`;
    text += `\n--------------------------------\n\n`;
    
    text += `${t.headerSelected}: ${activeStrategy.title}\n`;
    text += `${activeStrategy.description}\n\n`;
    
    text += `${t.headerRoadmap}:\n`;

    activeStrategy.plan?.forEach((item, idx) => {
       if (item.type === 'single') {
          const check = item.step.isCompleted ? '[x]' : '[ ]';
          text += `${idx + 1}. ${check} ${item.step.instruction}\n`;
           if (item.step.subSteps) {
              item.step.subSteps.forEach((sub) => {
                 const subCheck = sub.isCompleted ? '[x]' : '[ ]';
                 text += `   - ${subCheck} ${sub.instruction}\n`;
              });
           }
       } else {
          text += `${idx + 1}. ${t.simultaneous}:\n`;
          item.group.steps.forEach((step) => {
             const check = step.isCompleted ? '[x]' : '[ ]';
             text += `   - ${check} ${step.instruction}\n`;
              if (step.subSteps) {
                 step.subSteps.forEach((sub) => {
                    const subCheck = sub.isCompleted ? '[x]' : '[ ]';
                    text += `     * ${subCheck} ${sub.instruction}\n`;
                 });
              }
          });
       }
    });

    if (state.resources.length > 0) {
        text += `\n--------------------------------\n\n`;
        text += `${t.headerResources}:\n`;
        state.resources.forEach(res => {
           text += `\n[${res.name}]\n`;
           if (res.acquisitionSteps) {
               res.acquisitionSteps.forEach((step, idx) => {
                   text += `${idx + 1}. ${step.instruction}\n`;
               });
           } else {
               text += `(Plan not generated yet)\n`;
           }
        });
    }

    return text;
  };

  const handleCopyPlan = () => {
    const text = generatePlainText();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadPlan = () => {
    const text = generatePlainText();
    const element = document.createElement("a");
    const file = new Blob([text], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    element.download = "process-jinn-plan.md";
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
    document.body.removeChild(element);
  };

  const selectedResource = state.resources.find(r => r.id === state.selectedResourceId) || null;
  const activeStrategy = state.strategies.find(s => s.id === state.selectedStrategyId);

  // --- Render Sections ---

  const renderHeader = () => (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/70 border-b border-slate-200 supports-[backdrop-filter]:bg-white/60">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={handleReset}>
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-1.5 rounded-lg text-white shadow-md shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
            <Wand2 className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 group-hover:text-indigo-600 transition-colors">{t.appTitle}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleLanguage}
            className="text-sm font-semibold text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors border border-transparent hover:border-indigo-100"
          >
            {state.language === 'en' ? '中文' : 'English'}
          </button>

          {state.stage !== 'INPUT' && state.stage !== 'PROCESSING' && (
             <button 
               onClick={handleReset} 
               className="px-4 py-2 rounded-full text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
             >
               {t.newGoal}
             </button>
          )}
        </div>
      </div>
    </header>
  );

  const renderInputScreen = () => (
    <div className="max-w-2xl mx-auto space-y-8 pt-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
          {t.inputTitle}
        </h2>
        <p className="text-lg text-slate-600 max-w-lg mx-auto leading-relaxed">
          {t.inputSubtitle}
        </p>
      </div>

      <div className="bg-white p-2 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200">
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="goal" className="block text-sm font-semibold text-slate-700">{t.labelGoal}</label>
            <textarea
              id="goal"
              placeholder={t.placeholderGoal}
              className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none h-32 text-lg placeholder:text-slate-400"
              value={state.description}
              onChange={(e) => setState(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="quantification" className="block text-sm font-semibold text-slate-700">{t.labelSpecifics} <span className="text-slate-400 font-normal">{t.labelOptional}</span></label>
              <input
                id="quantification"
                type="text"
                placeholder={t.placeholderSpecifics}
                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={state.quantification}
                onChange={(e) => setState(prev => ({ ...prev, quantification: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="environment" className="block text-sm font-semibold text-slate-700">{t.labelEnvironment} <span className="text-slate-400 font-normal">{t.labelOptional}</span></label>
              <input
                id="environment"
                type="text"
                placeholder={t.placeholderEnvironment}
                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                value={state.environment}
                onChange={(e) => setState(prev => ({ ...prev, environment: e.target.value }))}
              />
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={!state.description.trim()}
            className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group relative overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
               {t.btnGenerate} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
        </div>
        
        {state.error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm text-center rounded-b-2xl border-t border-red-100">
            {state.error}
          </div>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">{t.examplesLabel}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {t.examples.map(ex => (
            <button 
              key={ex}
              onClick={() => setState(prev => ({ ...prev, description: ex }))}
              className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderProcessingScreen = () => (
    <div className="max-w-xl mx-auto pt-32 text-center animate-in fade-in duration-700">
       <div className="relative w-24 h-24 mx-auto mb-10">
         <div className="absolute inset-0 border-[6px] border-slate-100 rounded-full"></div>
         <div className="absolute inset-0 border-[6px] border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
         <div className="absolute inset-0 flex items-center justify-center">
            <Wand2 className="w-8 h-8 text-indigo-500 animate-pulse" />
         </div>
       </div>
       <h2 className="text-2xl font-bold text-slate-800 mb-3 min-h-[2rem]">
         {state.selectedStrategyId ? t.loadingPlan : LOADING_MESSAGES[loadingMsgIndex]}
       </h2>
       <p className="text-slate-500">
         {state.selectedStrategyId ? "" : "This might take a moment as we calculate the best path."}
       </p>
    </div>
  );

  const renderSelectionScreen = () => (
    <div className="max-w-6xl mx-auto pt-8 space-y-10 animate-in slide-in-from-bottom-8 duration-500">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-bold text-slate-900">{t.selectionTitle}</h2>
        <p className="text-slate-600 text-lg">{t.selectionSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {state.strategies.map((strategy, idx) => (
          <div 
            key={strategy.id} 
            className="group relative bg-white rounded-2xl border border-slate-200 hover:border-indigo-200 shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 flex flex-col h-full overflow-hidden cursor-pointer"
            onClick={() => handleSelectStrategy(strategy.id)}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            
            <div className="p-8 flex-grow">
              <div className="flex items-center gap-4 mb-6">
                <span className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 flex items-center justify-center text-lg font-bold border border-slate-100 group-hover:border-indigo-100 transition-colors">
                  {idx + 1}
                </span>
                <h3 className="text-xl font-bold text-slate-900 leading-tight group-hover:text-indigo-700 transition-colors">
                  {strategy.title}
                </h3>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {strategy.description}
              </p>
            </div>
            
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 mt-auto">
              <button className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl text-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:border-transparent transition-all flex items-center justify-center gap-2 shadow-sm">
                {t.btnSelect} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center">
         <button onClick={handleReset} className="text-slate-400 hover:text-slate-600 text-sm font-medium">
          {t.newGoal}
        </button>
      </div>
    </div>
  );

  const renderProcessScreen = () => {
    if (!activeStrategy || !activeStrategy.plan) return null;

    const isPanelOpen = !!selectedResource;

    return (
      <div className="animate-in fade-in duration-500 pb-20">
        <div className="max-w-7xl mx-auto mb-8 flex items-center justify-between">
           <button 
             onClick={handleBackToSelection}
             className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors font-medium text-sm px-4 py-2 rounded-full hover:bg-white border border-transparent hover:border-slate-200"
           >
             <ArrowLeft className="w-4 h-4" /> {t.btnBack}
           </button>

           <div className="flex gap-2">
              <button
                onClick={handleCopyPlan}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all shadow-sm"
              >
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                {copied ? t.copied : t.btnCopy}
              </button>
              <button
                onClick={handleDownloadPlan}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-all shadow-sm hover:shadow"
              >
                <Download className="w-4 h-4" />
                {t.btnSave}
              </button>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative transition-all duration-300">
          {/* Left Column: Process */}
          <div className={`${isPanelOpen ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-6 transition-all duration-500`}>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-8 border-b border-slate-100 bg-slate-50/30">
                 <div className="flex items-center gap-3 mb-3">
                    <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">{t.headerSelected}</span>
                 </div>
                 <h2 className="text-3xl font-bold text-slate-900 mb-3">{activeStrategy.title}</h2>
                 <p className="text-lg text-slate-600 leading-relaxed">{activeStrategy.description}</p>
                 
                 {/* Tip is now shown here when panel is closed to guide user */}
                 {!isPanelOpen && (
                   <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 bg-blue-50/50 p-3 rounded-lg border border-blue-100/50 max-w-fit">
                      <Layers className="w-4 h-4 text-blue-500" />
                      <span>{t.resourceTip} <span className="font-semibold text-indigo-600">Blue Pills</span> {t.resourceTip3}</span>
                   </div>
                 )}
              </div>
              <div className="p-8">
                <div className="flex items-center gap-2 mb-8 text-slate-400 font-semibold uppercase text-xs tracking-wider">
                  <Layers className="w-4 h-4" /> {t.headerRoadmap}
                </div>
                <StepList 
                  items={activeStrategy.plan} 
                  onExpandStep={(step) => handleExpandStep(step, activeStrategy.title)} 
                  onResourceClick={handleResourceClick}
                  onToggleComplete={handleToggleComplete}
                  onEditStep={handleEditStep}
                  onRegenerateStep={handleRegenerateStep}
                  labels={{
                    expand: t.expand,
                    collapse: t.collapse,
                    simultaneous: t.simultaneous,
                    edit: t.edit,
                    regenerate: t.regenerate,
                    save: t.save,
                    cancel: t.cancel,
                    postEditTitle: t.postEditTitle,
                    actionJustSave: t.actionJustSave,
                    actionSubsteps: t.actionSubsteps,
                    actionFuture: t.actionFuture
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Resource Panel (Conditionally Rendered) */}
          {isPanelOpen && (
            <div className="lg:col-span-4">
               <div className="sticky top-24">
                 <div className="flex items-center gap-2 text-slate-400 font-medium text-sm uppercase tracking-wider mb-4 px-1">
                    {t.headerResources}
                 </div>
                 <ResourcePanel 
                   resource={selectedResource} 
                   onResourceClick={handleResourceClick}
                   onClose={() => setState(prev => ({ ...prev, selectedResourceId: null }))}
                   labels={{
                     acquisitionPlan: t.acquisitionPlan,
                     generating: t.generating
                   }}
                 />
               </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {renderHeader()}
      <main className="max-w-7xl mx-auto px-4 py-8 relative">
        {state.stage === 'INPUT' && renderInputScreen()}
        {state.stage === 'PROCESSING' && renderProcessingScreen()}
        {state.stage === 'SELECTION' && renderSelectionScreen()}
        {state.stage === 'PROCESS' && renderProcessScreen()}
      </main>
    </div>
  );
};

export default App;