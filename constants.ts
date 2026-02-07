
import { NodeType, NodeData, Edge, Project } from './types';

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
      structuredProductName: 'Mars Sample Retrieval System',
      structuredPersona: 'Mars Exploration Program Mission Control & Planetary Scientists',
      structuredFeatures: '- Autonomous Navigation (15-min delay handling, obstacle detection)\n- Deep Drilling System (2 meters depth, 5 sample types)\n- Sterile Sample Storage (99.99% sterility assurance)\n- Science Payload (Spectroscopy, thermal imaging, gas analysis)\n- Power Management (Solar + thermal battery for 2-week missions)\n- Remote Diagnostics (Real-time health monitoring)',
      structuredConstraints: 'Max 50kg payload weight\nWithstand -120°C, dust storms, radiation\n15-minute communication latency\nQ4 Deadline for Field Testing',
      structuredResources: 'Mars Analog Sites (Chile, Arizona)\nEnvironmental Test Chambers\nPrototyping Lab & Assembly Team',
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
      prompt: 'Analyze this product requirement and output ONLY this JSON structure (no markdown, no explanation):\n\n{\n  "product_name": "string - extracted from input",\n  "vision": "string - max 50 words",\n  "raw_requirements": "string - consolidated list of all mentioned features",\n  "features": [\n    {\n      "id": "feature_1",\n      "name": "string",\n      "description": "string - max 20 words",\n      "priority": "must_have|should_have|could_have|wont_have",\n      "estimated_effort": 1-10,\n      "dependencies": ["feature_name_reference"]\n    }\n  ],\n  "must_have_count": 0,\n  "should_have_count": 0,\n  "could_have_count": 0,\n  "team_size": 0,\n  "timeline_months": 12,\n  "key_constraints": ["string"]\n}\n\nInput: {{userInput}}',
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
      prompt: 'Create a quarterly roadmap organized by WORKSTREAMS. Perform predictive analysis and BREAK DOWN tasks.\n\nOutput ONLY this JSON structure:\n\n{\n  "strategy": "string - max 50 words",\n  "workstreams": [\n    {\n      "name": "string (e.g., Core Platform, User Experience)",\n      "purpose": "Single sentence explaining WHY this workstream exists.",\n      "features": ["feature_name_must_match_exactly"]\n    }\n  ],\n  "quarterly_breakdown": {\n    "Q1": { "milestone_gate": "Decision Gate Name (e.g., Architecture Sign-off)" },\n    "Q2": { "milestone_gate": "Decision Gate Name" },\n    "Q3": { "milestone_gate": "Decision Gate Name" },\n    "Q4": { "milestone_gate": "Decision Gate Name" }\n  },\n  "feature_metadata": [\n    {\n      "name": "feature_name_must_match_exactly",\n      "assigned_quarters": [1, 2], \n      "risk_level": "low|medium|high",\n      "confidence_score": 0-100,\n      "prediction_rationale": "Why this score?",\n      "status": "planned|in_progress|completed|blocked|at_risk",\n      "subtasks": [\n          { "name": "Technical Step 1", "status": "completed|planned" },\n          { "name": "Technical Step 2", "status": "planned" }\n      ],\n      "is_critical_path": true,\n      "dependencies": ["other_feature_name"]\n    }\n  ],\n  "ai_insights": [\n    {\n      "type": "risk|bottleneck|resource",\n      "title": "short title",\n      "description": "concise insight",\n      "severity": "high|medium|low"\n    }\n  ]\n}\n\nRules:\n1. Organize all features from input into logical Workstreams.\n2. Milestones must be DECISION GATES (e.g., "Go/No-Go"), not just dates.\n3. Break down each feature into 2-4 subtasks (technical implementation steps).\n\nBased on: {{extractedData}}',
      outputVar: 'roadmapPlan'
    }
  },
  {
    id: 'agent-polish',
    type: NodeType.AGENT,
    label: 'Polish & Export',
    x: 1600,
    y: 300,
    description: 'Generates professional markdown report (Flash)',
    config: {
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are a technical product writer. Create professional, concise output.',
      prompt: 'Create a concise professional roadmap document. Output markdown:\n\n# {{extractedData.product_name}} - 12 Month Product Roadmap\n\n## Executive Summary\n{{extractedData.vision}}\n\n## Strategic Vision\n{{roadmapPlan.strategy}}\n\n## Workstreams & Objectives\n{{#each roadmapPlan.workstreams}}\n### {{name}}\n*Purpose: {{purpose}}*\n- Features: {{features}}\n{{/each}}\n\n## Decision Gates (Milestones)\n- Q1: {{roadmapPlan.quarterly_breakdown.Q1.milestone_gate}}\n- Q2: {{roadmapPlan.quarterly_breakdown.Q2.milestone_gate}}\n- Q3: {{roadmapPlan.quarterly_breakdown.Q3.milestone_gate}}\n- Q4: {{roadmapPlan.quarterly_breakdown.Q4.milestone_gate}}\n\n## AI Risk Analysis\n**Top Risks:**\n- ... (Extract high risks from roadmapPlan.ai_insights)\n\n## Generated\nDate: {{today}}',
      outputVar: 'finalRoadmap'
    }
  },
  {
    id: 'agent-visualize',
    type: NodeType.AGENT,
    label: 'Timeline Visualizer',
    x: 2100,
    y: 300,
    description: 'Generates Mermaid.js Gantt chart (Flash)',
    config: {
      model: 'gemini-3-flash-preview',
      systemInstruction: 'You are a data visualization expert. Generate ONLY Mermaid.js code.',
      prompt: 'Create a Mermaid.js Gantt chart for the roadmap in {{roadmapPlan}}. \n\nRequirements:\n1. Use "gantt" type.\n2. Title: Product Roadmap Timeline.\n3. DateFormat: YYYY-MM-DD.\n4. Define sections for Q1, Q2, Q3, Q4.\n5. Map workstreams as sections.\n6. Highlight Decision Gates as milestones.\n\nOutput ONLY the code inside a ```mermaid``` block. Do not add any other text.',
      outputVar: 'timelineCode'
    }
  },
  {
    id: 'end-node',
    type: NodeType.END,
    label: 'Final Roadmap',
    x: 2500,
    y: 300,
    description: 'Displays formatted roadmap and visual chart',
    config: {}
  }
];

export const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'trigger-input', target: 'agent-extract' },
  { id: 'e2', source: 'agent-extract', target: 'agent-plan' },
  { id: 'e3', source: 'agent-plan', target: 'agent-polish' },
  { id: 'e4', source: 'agent-polish', target: 'agent-visualize' },
  { id: 'e5', source: 'agent-visualize', target: 'end-node' }
];

export const MODEL_OPTIONS = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Fast)' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Reasoning)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
];

export const MARS_ROVER_PROJECT: Project = {
  id: 'mars-rover-demo',
  name: 'Mars Rover Retrieval Mission',
  updatedAt: Date.now(),
  nodes: INITIAL_NODES,
  edges: INITIAL_EDGES,
  logs: [],
  roadmapData: {
    summary: "Execute a high-stakes sample retrieval mission under extreme environmental constraints (dust, -120°C). The plan prioritizes autonomous survival systems in Q1, deep drilling capabilities in Q2, and integrated sterility/power validation in Q3/Q4.",
    workstreams: [
      { id: 'ws1', name: 'Autonomy & Software', purpose: 'Navigation and remote operations handling 15m latency.' },
      { id: 'ws2', name: 'Hardware & Mechanics', purpose: 'Drilling, containment, and chassis endurance.' },
      { id: 'ws3', name: 'Power & Environment', purpose: 'Thermal management and solar efficiency.' }
    ],
    milestones: [
      { name: 'Core Navigation Algorithm Freeze', quarter: 1 },
      { name: 'Drill Payload Integration', quarter: 2 },
      { name: 'Thermal Vacuum Chamber Test', quarter: 3 },
      { name: 'Final Mission Sim (Earth Analog)', quarter: 4 }
    ],
    features: [
      {
        id: 'feat-1',
        name: 'Autonomous Obstacle Avoidance',
        description: 'AI-driven pathfinding to handle terrain without real-time Earth comms.',
        priority: 'must_have',
        status: 'completed',
        risk: 'medium',
        quarters: [1],
        workstream: 'Autonomy & Software',
        effort: 8,
        team: 'Software',
        confidence: 90,
        isCriticalPath: true,
        dependencies: [],
        risks: ['Processing power limits'],
        subtasks: [
           { name: 'LIDAR Sensor Driver', status: 'completed', assignee: 'SW Team', dueDate: 'Q1', isBlocked: false },
           { name: 'Pathfinding Heuristics', status: 'completed', assignee: 'SW Team', dueDate: 'Q1', isBlocked: false }
        ]
      },
      {
        id: 'feat-2',
        name: 'Deep Drilling Mechanism (2m)',
        description: 'Hardened carbide drill assembly capable of 2m depth extraction.',
        priority: 'must_have',
        status: 'in_progress',
        risk: 'high',
        quarters: [1, 2],
        workstream: 'Hardware & Mechanics',
        effort: 10,
        team: 'Mech Eng',
        confidence: 70,
        isCriticalPath: true,
        dependencies: [],
        risks: ['Bit failure in basalt'],
        riskReason: 'Drill bit durability in unknown substrates poses mission failure risk.',
        subtasks: [
           { name: 'Motor Torque Calibration', status: 'completed', assignee: 'ME Team', dueDate: 'Q1', isBlocked: false },
           { name: 'Bit Exchange System', status: 'in_progress', assignee: 'ME Team', dueDate: 'Q2', isBlocked: false }
        ]
      },
      {
         id: 'feat-3',
         name: 'Sterile Sample Vault',
         description: 'Hermetically sealed storage to prevent Earth contamination.',
         priority: 'must_have',
         status: 'planned',
         risk: 'medium',
         quarters: [2],
         workstream: 'Hardware & Mechanics',
         effort: 6,
         team: 'Bio/Mech',
         confidence: 85,
         isCriticalPath: true,
         dependencies: ['feat-2'],
         subtasks: []
      },
      {
         id: 'feat-4',
         name: 'Solar-Thermal Battery System',
         description: 'Hybrid power unit for 2-week dust storm survival.',
         priority: 'should_have',
         status: 'planned',
         risk: 'low',
         quarters: [2, 3],
         workstream: 'Power & Environment',
         effort: 5,
         team: 'Power',
         confidence: 95,
         isCriticalPath: false,
         dependencies: [],
         subtasks: []
      },
      {
         id: 'feat-5',
         name: 'Remote Diagnostics Suite',
         description: 'Self-healing software for system health monitoring.',
         priority: 'could_have',
         status: 'at_risk',
         risk: 'low',
         quarters: [3],
         workstream: 'Autonomy & Software',
         effort: 4,
         team: 'Software',
         confidence: 60,
         isCriticalPath: false,
         dependencies: ['feat-1'],
         subtasks: []
      }
    ],
    insights: [
      { type: 'risk', title: 'Drill Durability', description: 'Basalt rock hardness exceeds current carbide bit specs.', severity: 'high' },
      { type: 'resource', title: 'Analog Site Availability', description: 'Chilean desert test site booking conflict in Q3.', severity: 'medium' }
    ]
  }
};
