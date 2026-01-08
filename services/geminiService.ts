import { GoogleGenAI, Type } from "@google/genai";
import { Step, Strategy, PlanItem, Language } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Generates 3 strategies (Titles & Descriptions only) for speed optimization.
 */
export const generateStrategies = async (
  goal: string,
  quantification: string,
  environment: string,
  language: Language
): Promise<Strategy[]> => {
  const langName = language === 'zh' ? 'Simplified Chinese' : 'English';
  
  const prompt = `
    User Goal: "${goal}"
    Quantification: "${quantification}"
    Context/Environment: "${environment}"

    Task: Generate exactly 3 distinct, highly reliable, and realistic strategies (options) to achieve this goal, taking into account the user's specific context/environment if provided.
    
    Requirements:
    1. Output in ${langName}.
    2. Provide ONLY the title and a persuasive description for each strategy.
    3. DO NOT generate the detailed steps yet.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      systemInstruction: `You are a helpful expert planner. You MUST output your response in ${langName}, even if the input text is in a different language.`,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["title", "description"],
        },
      },
    },
  });

  const rawStrategies = JSON.parse(response.text || "[]");

  return rawStrategies.map((s: any, stratIdx: number) => ({
    id: `strategy-${Date.now()}-${stratIdx}`,
    title: s.title,
    description: s.description,
    plan: [], // Empty initially for lazy loading
    planLanguage: undefined
  }));
};

/**
 * Generates the detailed plan for a specific strategy.
 */
export const generateStrategyPlan = async (
  strategy: Strategy,
  goal: string,
  environment: string,
  language: Language
): Promise<PlanItem[]> => {
  const langName = language === 'zh' ? 'Simplified Chinese' : 'English';

  const prompt = `
    Goal: "${goal}"
    Context/Environment: "${environment}"
    Selected Strategy: "${strategy.title}"
    Strategy Description: "${strategy.description}"

    Task: Generate a detailed execution plan for this strategy.

    Requirements:
    1. Output in ${langName}.
    2. The plan must consist of 3 to 5 high-level steps.
    3. An item can be a "single" step OR a "parallel" group of steps.
    4. For each step instruction: wrap specific tools, software, or physical resources in square brackets like [Hammer] or [VS Code]. Keep resource names in ${langName} or English as appropriate.
    5. List extracted resources array for each step.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      systemInstruction: `You are a helpful expert planner. You MUST output your response in ${langName}, even if the input text is in a different language.`,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["single", "parallel"] },
            instruction: { type: Type.STRING },
            resources: { type: Type.ARRAY, items: { type: Type.STRING } },
            parallelSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                   instruction: { type: Type.STRING },
                   resources: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["instruction", "resources"]
              }
            }
          },
        },
      },
    },
  });

  const rawPlan = JSON.parse(response.text || "[]");

  return rawPlan.map((item: any, itemIdx: number) => {
    const timestamp = Date.now();
    
    if (item.type === 'parallel' && item.parallelSteps) {
      return {
        type: 'parallel',
        group: {
          id: `group-${timestamp}-${itemIdx}`,
          steps: item.parallelSteps.map((ps: any, pIdx: number) => ({
            id: `step-${timestamp}-${itemIdx}-${pIdx}`,
            instruction: ps.instruction,
            resources: ps.resources || [],
            subSteps: [],
            isExpanded: false,
          }))
        }
      } as PlanItem;
    }

    return {
      type: 'single',
      step: {
        id: `step-${timestamp}-${itemIdx}`,
        instruction: item.instruction || "Do this step",
        resources: item.resources || [],
        subSteps: [],
        isExpanded: false,
      }
    } as PlanItem;
  });
};

export const expandStep = async (
  stepInstruction: string,
  context: string,
  language: Language
): Promise<Step[]> => {
  const langName = language === 'zh' ? 'Simplified Chinese' : 'English';

  const prompt = `
    Context: "${context}"
    Current Step: "${stepInstruction}"

    Task: Break down this specific step into 3 to 5 smaller sub-steps.
    
    Requirements:
    1. Output in ${langName}.
    2. Identify and bracket [Resources] if new ones appear.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      systemInstruction: `You are a helpful expert planner. You MUST output your response in ${langName}, even if the input text is in a different language.`,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            instruction: { type: Type.STRING },
            resources: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["instruction", "resources"],
        },
      },
    },
  });

  const rawSteps = JSON.parse(response.text || "[]");

  return rawSteps.map((st: any, idx: number) => ({
    id: `substep-${Date.now()}-${idx}`,
    instruction: st.instruction,
    resources: st.resources || [],
  }));
};

export const generateResourcePlan = async (resourceName: string, language: Language): Promise<Step[]> => {
  const langName = language === 'zh' ? 'Simplified Chinese' : 'English';

  const prompt = `
    Resource needed: "${resourceName}"

    Task: Provide a 3 to 5 step process on how a user can acquire, install, buy, or learn to use this resource.
    
    Requirements:
    1. Output in ${langName}.
    2. Wrap any sub-resources in brackets [Like This] if necessary.
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      systemInstruction: `You are a helpful expert planner. You MUST output your response in ${langName}, even if the input text is in a different language.`,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            instruction: { type: Type.STRING },
            resources: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["instruction", "resources"],
        },
      },
    },
  });

  const rawSteps = JSON.parse(response.text || "[]");

  return rawSteps.map((st: any, idx: number) => ({
    id: `res-step-${Date.now()}-${idx}`,
    instruction: st.instruction,
    resources: st.resources || [],
  }));
};

export const regenerateStepText = async (
  currentInstruction: string,
  context: string,
  language: Language
): Promise<{ instruction: string, resources: string[] }> => {
  const langName = language === 'zh' ? 'Simplified Chinese' : 'English';

  const prompt = `
    Context: "${context}"
    Current Instruction: "${currentInstruction}"

    Task: Rewrite the current instruction to be more clear, actionable, or alternative. Keep the same intent but improve the phrasing or method.
    
    Requirements:
    1. Output in ${langName}.
    2. Bracket [Resources].
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          instruction: { type: Type.STRING },
          resources: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["instruction", "resources"],
      },
    },
  });

  return JSON.parse(response.text || "{}");
};

export const regenerateFutureSteps = async (
  goal: string,
  contextBefore: string[],
  currentStep: string,
  count: number,
  language: Language
): Promise<PlanItem[]> => {
  const langName = language === 'zh' ? 'Simplified Chinese' : 'English';

  const prompt = `
    Goal: "${goal}"
    History of steps already planned/completed: ${JSON.stringify(contextBefore)}
    The step that just changed/edited: "${currentStep}"

    Task: Generate the remaining ${count} steps needed to complete the goal, starting AFTER "The step that just changed". The flow must adapt to the changed step.

    Requirements:
    1. Output in ${langName}.
    2. Generate exactly ${count} items.
    3. Items can be single or parallel.
    4. Bracket [Resources].
  `;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      systemInstruction: `You are a helpful expert planner. You MUST output your response in ${langName}, even if the input text is in a different language.`,
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["single", "parallel"] },
            instruction: { type: Type.STRING },
            resources: { type: Type.ARRAY, items: { type: Type.STRING } },
            parallelSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                   instruction: { type: Type.STRING },
                   resources: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["instruction", "resources"]
              }
            }
          },
        },
      },
    },
  });

  const rawPlan = JSON.parse(response.text || "[]");

  return rawPlan.map((item: any, itemIdx: number) => {
    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).substr(2, 5);
    
    if (item.type === 'parallel' && item.parallelSteps) {
      return {
        type: 'parallel',
        group: {
          id: `group-regen-${timestamp}-${uniqueId}-${itemIdx}`,
          steps: item.parallelSteps.map((ps: any, pIdx: number) => ({
            id: `step-regen-${timestamp}-${uniqueId}-${itemIdx}-${pIdx}`,
            instruction: ps.instruction,
            resources: ps.resources || [],
            subSteps: [],
            isExpanded: false,
          }))
        }
      } as PlanItem;
    }

    return {
      type: 'single',
      step: {
        id: `step-regen-${timestamp}-${uniqueId}-${itemIdx}`,
        instruction: item.instruction || "Do this step",
        resources: item.resources || [],
        subSteps: [],
        isExpanded: false,
      }
    } as PlanItem;
  });
};
