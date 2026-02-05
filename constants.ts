import { NodeType, NodeData, Edge } from './types';

export const INITIAL_NODES: NodeData[] = [
  {
    id: 'trigger-input',
    type: NodeType.TRIGGER,
    label: 'Roadmap Input',
    x: 100,
    y: 300,
    description: 'Accepts structured product requirements.',
    config: {
      inputType: 'structured',
      structuredProductName: 'FitTrack Pro',
      structuredPersona: 'Busy professionals aged 25-40 who want data-driven workout insights',
      structuredFeatures: '- User authentication (Social login)\n- Workout logging (Sets, Reps, Weight)\n- Progress charts (Volume, Max weight)\n- AI Coaching recommendations (Premium)\n- Leaderboards',
      structuredConstraints: 'Must launch Beta in Q2 2024\nGA in Q4 2024\nMobile-first approach',
      structuredResources: '5 Engineers (2 Backend, 2 Frontend, 1 Mobile)\n$50k budget for design',
      outputVar: 'userInput'
    }
  },
  {
    id: 'agent-extract',
    type: NodeType.AGENT,
    label: 'Extract & Prioritize',
    x: 600,
    y: 300,
    description: 'Extracts requirements and priorities (Flash)',
    config: {
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are a product requirements analyst. Output ONLY valid JSON, no other text.',
      prompt: 'Analyze this product requirement and output ONLY this JSON structure (no markdown, no explanation):\n\n{\n  "product_name": "string - extracted from input",\n  "vision": "string - max 100 words",\n  "raw_requirements": "string - consolidated list of all mentioned features",\n  "features": [\n    {\n      "id": "feature_1",\n      "name": "string",\n      "description": "string - max 50 words",\n      "priority": "must_have|should_have|could_have|wont_have",\n      "estimated_effort": 1-10,\n      "dependencies": ["feature_name_reference"]\n    }\n  ],\n  "must_have_count": 0,\n  "should_have_count": 0,\n  "could_have_count": 0,\n  "team_size": 0,\n  "timeline_months": 12,\n  "key_constraints": ["string"]\n}\n\nInput: {{userInput}}',
      outputVar: 'extractedData'
    }
  },
  {
    id: 'agent-plan',
    type: NodeType.AGENT,
    label: 'Plan & Intelligence',
    x: 1100,
    y: 300,
    description: 'Creates quarterly plan, risk analysis, and resource mapping (Flash)',
    config: {
      model: 'gemini-3-flash-preview',
      useSearch: true,
      systemInstruction: 'You are a senior technical program manager. Output ONLY valid JSON.',
      prompt: 'Create a detailed quarterly roadmap with intelligent analysis. Output ONLY this JSON:\n\n{\n  "strategy": "string - max 150 words",\n  "quarterly_breakdown": {\n    "Q1": { "features": ["feature names"], "narrative": "string", "milestone": "string" },\n    "Q2": { "features": ["feature names"], "narrative": "string", "milestone": "string" },\n    "Q3": { "features": ["feature names"], "narrative": "string", "milestone": "string" },\n    "Q4": { "features": ["feature names"], "narrative": "string", "milestone": "string" }\n  },\n  "feature_metadata": [\n    {\n      "name": "feature_name_must_match_exactly",\n      "risk_level": "low|medium|high",\n      "risk_reason": "why is this risky?",\n      "assigned_team": "Backend|Frontend|Mobile|Design|Data",\n      "confidence_score": 80,\n      "is_critical_path": true,\n      "status": "planned|in_progress|completed|blocked|at_risk"\n    }\n  ],\n  "ai_insights": [\n    {\n      "type": "risk|bottleneck|resource",\n      "title": "short title",\n      "description": "detailed insight",\n      "severity": "high|medium|low"\n    }\n  ],\n  "visualization_data": {\n    "milestones": [\n      {"quarter": 2, "name": "string", "type": "beta|launch|release"}\n    ]\n  }\n}\n\nPredict status based on constraints (e.g. mark aggressive Q1 items as at_risk).\n\nBased on: {{extractedData}}',
      outputVar: 'roadmapPlan'
    }
  },
  {
    id: 'agent-polish',
    type: NodeType.AGENT,
    label: 'Polish & Export',
    x: 1600,
    y: 300,
    description: 'Generates professional markdown report (Pro)',
    config: {
      model: 'gemini-3-pro-preview',
      systemInstruction: 'You are a technical product writer. Create professional, concise output.',
      prompt: 'Create a professional roadmap document. Output markdown:\n\n# {{extractedData.product_name}} - 12 Month Product Roadmap\n\n## Executive Summary\n{{extractedData.vision}}\n\n## Strategic Vision\n{{roadmapPlan.strategy}}\n\n## AI Risk & Resource Analysis\n**Top Risks:**\n- ... (Extract high risks from roadmapPlan.ai_insights)\n\n**Critical Path Items:**\n- ... (List critical path items from roadmapPlan.feature_metadata)\n\n## Quarterly Breakdown\n\n### Q1: {{roadmapPlan.quarterly_breakdown.Q1.milestone}}\n{{roadmapPlan.quarterly_breakdown.Q1.narrative}}\n**Features:** {{roadmapPlan.quarterly_breakdown.Q1.features}}\n\n### Q2: {{roadmapPlan.quarterly_breakdown.Q2.milestone}}\n{{roadmapPlan.quarterly_breakdown.Q2.narrative}}\n**Features:** {{roadmapPlan.quarterly_breakdown.Q2.features}}\n\n### Q3: {{roadmapPlan.quarterly_breakdown.Q3.milestone}}\n{{roadmapPlan.quarterly_breakdown.Q3.narrative}}\n**Features:** {{roadmapPlan.quarterly_breakdown.Q3.features}}\n\n### Q4: {{roadmapPlan.quarterly_breakdown.Q4.milestone}}\n{{roadmapPlan.quarterly_breakdown.Q4.narrative}}\n**Features:** {{roadmapPlan.quarterly_breakdown.Q4.features}}\n\n## Generated\nDate: {{today}}\nBased on: {{extractedData.product_name}}',
      outputVar: 'finalRoadmap'
    }
  },
  {
    id: 'end-node',
    type: NodeType.END,
    label: 'Final Roadmap',
    x: 2000,
    y: 300,
    description: 'Displays formatted roadmap and visual chart',
    config: {}
  }
];

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'trigger-input', target: 'agent-extract' },
  { id: 'e2', source: 'agent-extract', target: 'agent-plan' },
  { id: 'e3', source: 'agent-plan', target: 'agent-polish' },
  { id: 'e4', source: 'agent-polish', target: 'end-node' }
];

export const MODEL_OPTIONS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Fast)' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Reasoning)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];