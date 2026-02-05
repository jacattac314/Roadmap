import { NodeType, NodeData, Edge } from './types';

export const INITIAL_NODES: NodeData[] = [
  {
    id: 'trigger-input',
    type: NodeType.TRIGGER,
    label: 'Roadmap Input',
    x: 100,
    y: 300,
    description: 'Accepts product requirements via text, file, or audio.',
    config: {
      inputType: 'text',
      staticInput: '---\ntype: "feature"\ntitle: "Gemini intelligence in your app"\nicon: "spark"\n---\n\nYou MUST add Gemini to the app where relevant to complete all sorts of tasks - analyze content, make edits, and more. These are suggested ideas. Use Pro for complex tasks and Flash or Flash-Lite for tasks that should happen fast.\n\n---\ntype: "feature"\ntitle: "Transcribe audio"\nicon: "speech_to_text"\n---\n\nAdd a feature where users can input audio with their microphone and the app with transcribe it. You MUST add audio transcription to the app using model gemini-3-flash-preview\n\n---\ntype: "feature"\ntitle: "Use Google Search data"\nicon: "google"\n---\n\nYou MUST add Search Grounding to the app where relevant to get up to date and accurate information. Use gemini-3-flash-preview (with googleSearch tool)',
      outputVar: 'userInput'
    }
  },
  {
    id: 'agent-audio-transcriber',
    type: NodeType.AGENT,
    label: 'Audio Transcriber',
    x: 400,
    y: 300,
    description: 'Transcribes audio input into text for processing.',
    config: {
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are an expert audio transcriber. Your goal is to accurately transcribe audio inputs. If the input is a text file or string, simply return it verbatim.',
      prompt: 'Please transcribe the following input: {{userInput}}',
      outputVar: 'transcribedOutput'
    }
  },
  {
    id: 'agent-transcript',
    type: NodeType.AGENT,
    label: 'Transcript Processor',
    x: 700,
    y: 300,
    description: 'Extracts structured requirements from raw input.',
    config: {
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are a product analyst. Output purely in JSON.',
      prompt: 'Extract key information from the provided input ({{transcribedOutput}}):\n     1. List all mentioned features/requirements\n     2. Identify user pain points and needs\n     3. Extract stakeholder opinions/priorities\n     4. Summarize key business goals\n     5. Note any constraints or limitations\n     \n     Format as structured JSON with sections: features, pain_points, stakeholders, goals, constraints',
      outputVar: 'transcriptOutput'
    }
  },
  {
    id: 'agent-feature-specs',
    type: NodeType.AGENT,
    label: 'Market Research',
    x: 1000,
    y: 300,
    description: 'Leverages Google Search to provide market context for roadmap features.',
    config: {
      model: 'gemini-3-flash-preview',
      useSearch: true,
      systemInstruction: 'You are a technical product owner. Output purely in JSON.',
      prompt: 'Take the features identified here ({{transcriptOutput}}) and expand them into technical specifications.\n\n1. Use Google Search to find best practices for implementing these specific Gemini features (Audio, Search, Intelligence).\n2. Define acceptance criteria for each.\n3. Suggest specific API endpoints or model names where relevant.\n\nFormat as JSON with key "detailed_specs" containing a list of feature objects.',
      outputVar: 'specsOutput'
    }
  },
  {
    id: 'agent-prioritizer',
    type: NodeType.AGENT,
    label: 'Requirements Prioritizer',
    x: 1300,
    y: 300,
    description: 'Prioritizes features using MoSCoW method.',
    config: {
      model: 'gemini-3-pro-preview',
      systemInstruction: 'You are a product manager expert. Output purely in JSON.',
      prompt: 'Analyze these technical specifications ({{specsOutput}}) and:\n     1. Apply MoSCoW prioritization (Must Have, Should Have, Could Have, Won\'t Have)\n     2. Estimate effort/complexity (1-10 scale)\n     3. Identify feature dependencies\n     4. Calculate priority scores (importance × urgency)\n     5. Group by category\n     \n     Format as JSON with: must_have, should_have, could_have, wont_have, dependencies, priority_scores',
      outputVar: 'prioritiesOutput'
    }
  },
  {
    id: 'agent-timeline',
    type: NodeType.AGENT,
    label: 'Roadmap Timeline Planner',
    x: 1600,
    y: 300,
    description: 'Creates a quarterly release schedule.',
    config: {
      model: 'gemini-3-pro-preview',
      systemInstruction: 'You are a strategic product planner. Output purely in JSON.',
      prompt: 'Using these priorities ({{prioritiesOutput}}), create a 12-month roadmap:\n     1. Divide features into quarterly phases (Q1, Q2, Q3, Q4)\n     2. Consider dependencies and release sequence\n     3. Balance priorities with team capacity\n     4. Include milestones and key dates\n     5. Create brief narrative for each quarter\n     \n     Format as JSON with: q1_features, q1_narrative, q2_features, q2_narrative, q3_features, q3_narrative, q4_features, q4_narrative, high_level_strategy',
      outputVar: 'timelineOutput'
    }
  },
  {
    id: 'agent-summary',
    type: NodeType.AGENT,
    label: 'Executive Summary',
    x: 1900,
    y: 150,
    description: 'Generates a high-level overview for stakeholders.',
    config: {
      model: 'gemini-3-pro-preview',
      systemInstruction: 'You are a professional product communicator.',
      prompt: 'Create a 200-word executive summary based on the strategy ({{timelineOutput}}) that includes:\n     1. Product vision statement\n     2. Key business objectives\n     3. Top 5 features planned\n     4. Timeline overview\n     5. Success metrics\n     Make it professional and persuasive.',
      outputVar: 'summaryOutput'
    }
  },
  {
    id: 'agent-formatter',
    type: NodeType.AGENT,
    label: 'Roadmap Formatter',
    x: 1900,
    y: 450,
    description: 'Compiles the final comprehensive markdown document.',
    config: {
      model: 'gemini-3-pro-preview',
      systemInstruction: 'You are a technical writer.',
      prompt: 'Format all roadmap information into a professional document.\n\nSummary: {{summaryOutput}}\n\nTimeline: {{timelineOutput}}\n\nPriorities: {{prioritiesOutput}}\n\nStructure:\n     1. EXECUTIVE SUMMARY section\n     2. PRODUCT VISION & GOALS\n     3. QUARTERLY BREAKDOWN with features and timelines\n     4. PRIORITY MATRIX (must/should/could/won\'t)\n     5. TECHNICAL SPECS & RESEARCH (from Google Search)\n     6. SUCCESS METRICS\n     7. NOTES & ASSUMPTIONS\n     Output in markdown format suitable for stakeholder review.',
      outputVar: 'finalRoadmap',
      useSearch: true
    }
  },
  {
    id: 'end-node',
    type: NodeType.END,
    label: 'Final Roadmap',
    x: 2200,
    y: 300,
    description: 'Displays the generated roadmap.',
    config: {}
  }
];

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'trigger-input', target: 'agent-audio-transcriber' },
  { id: 'e2', source: 'agent-audio-transcriber', target: 'agent-transcript' },
  { id: 'e3', source: 'agent-transcript', target: 'agent-feature-specs' },
  { id: 'e4', source: 'agent-feature-specs', target: 'agent-prioritizer' },
  { id: 'e5', source: 'agent-prioritizer', target: 'agent-timeline' },
  { id: 'e6', source: 'agent-timeline', target: 'agent-summary' },
  { id: 'e7', source: 'agent-timeline', target: 'agent-formatter' },
  { id: 'e8', source: 'agent-summary', target: 'agent-formatter' },
  { id: 'e9', source: 'agent-formatter', target: 'end-node' }
];

export const MODEL_OPTIONS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Fast)' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Reasoning)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];