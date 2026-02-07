
import { RoadmapData, RoadmapFeature, PriorityLevel, RiskLevel, Status, AIInsight, Workstream, Subtask } from '../types';

export const parseRoadmapData = (extractedData: any, roadmapPlan: any): RoadmapData | null => {
  try {
    const robustJsonParse = (input: any) => {
        if (!input) return {};
        if (typeof input === 'object') return input;
        
        // Remove markdown wrappers and whitespace
        let clean = String(input).replace(/```json\n?|```/g, '').trim();
        
        // Find the first '{' and the last '}' to isolate the JSON object
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        
        if (start !== -1 && end !== -1 && end > start) {
            const jsonStr = clean.substring(start, end + 1);
            try {
                return JSON.parse(jsonStr);
            } catch (e) {
                console.warn("Regex-based JSON extraction failed, attempting brute clean", e);
                // Attempt to fix common issues like trailing commas
                const fixedStr = jsonStr.replace(/,\s*([\]}])/g, '$1');
                try { return JSON.parse(fixedStr); } catch (inner) { return {}; }
            }
        }
        return {};
    };

    const extracted = robustJsonParse(extractedData);
    const plan = robustJsonParse(roadmapPlan);

    // Critical check: if no features or workstreams, we can't build a roadmap
    const rawFeatures = extracted.features || plan.features || [];
    if (rawFeatures.length === 0 && (!plan.workstreams || plan.workstreams.length === 0)) {
        return null;
    }

    const workstreams: Workstream[] = (plan.workstreams || []).map((ws: any) => ({
      id: ws.name || Math.random().toString(),
      name: ws.name || 'Core Operations',
      purpose: ws.purpose || 'Alignment and execution target.'
    }));

    const featuresMap = new Map<string, RoadmapFeature>();
    const detailsByName = new Map();
    (rawFeatures).forEach((f: any) => {
      if (f.name) detailsByName.set(f.name.toLowerCase().trim(), f);
    });

    const metaByName = new Map();
    if (plan.feature_metadata) {
        plan.feature_metadata.forEach((m: any) => {
          if (m.name) metaByName.set(m.name.toLowerCase().trim(), m);
        });
    }

    // Process each workstream's features
    const workstreamsList = plan.workstreams || [{ name: 'Core', features: rawFeatures.map((f:any) => f.name) }];

    workstreamsList.forEach((ws: any) => {
      const wsName = ws.name || 'General';
      const wsFeatures = ws.features || [];

      wsFeatures.forEach((featName: string) => {
        if (!featName) return;
        const lowerName = featName.toLowerCase().trim();
        if (featuresMap.has(lowerName)) return;

        const detail = detailsByName.get(lowerName) || {};
        const meta = metaByName.get(lowerName) || {};
        
        let priority: PriorityLevel = 'could_have';
        const p = String(detail.priority || meta.priority || '').toLowerCase();
        if (p.includes('must')) priority = 'must_have';
        else if (p.includes('should')) priority = 'should_have';

        let risk: RiskLevel = 'low';
        const r = String(meta.risk_level || '').toLowerCase();
        if (r.includes('high')) risk = 'high';
        else if (r.includes('medium')) risk = 'medium';

        let status: Status = 'planned';
        const s = String(meta.status || '').toLowerCase();
        if (s.includes('progress')) status = 'in_progress';
        else if (s.includes('completed') || s.includes('done')) status = 'completed';
        else if (s.includes('block')) status = 'blocked';

        const subtasks: Subtask[] = (meta.subtasks || []).map((st: any) => ({
            name: st.name || 'Process Item',
            status: (st.status as Status) || 'planned',
            assignee: st.assignee || meta.assigned_team || 'Engineers',
            dueDate: st.due_date || (status === 'completed' ? 'Done' : 'TBD'),
            isBlocked: !!st.is_blocked
        }));

        const feature: RoadmapFeature = {
            id: detail.id || `f-${Math.random().toString(36).substr(2, 5)}`,
            name: featName,
            priority: priority,
            quarters: meta.assigned_quarters || [1],
            dependencies: meta.dependencies || detail.dependencies || [],
            description: detail.description || 'Strategic development item.',
            effort: detail.estimated_effort || 5,
            workstream: wsName,
            status: status,
            subtasks: subtasks,
            risk: risk,
            riskReason: meta.risk_reason,
            risks: meta.explicit_risks || [],
            team: meta.assigned_team || 'Cross-Functional',
            confidence: meta.confidence_score || 75,
            isCriticalPath: !!meta.is_critical_path,
            predictionRationale: meta.prediction_rationale
        };

        featuresMap.set(lowerName, feature);
      });
    });

    const milestones = [];
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, idx) => {
        const m = plan.quarterly_breakdown?.[q]?.milestone_gate || plan.quarterly_breakdown?.[q]?.milestone;
        if (m) milestones.push({ name: m, quarter: idx + 1 });
    });

    return {
      workstreams,
      features: Array.from(featuresMap.values()),
      milestones: milestones.length > 0 ? milestones : [{name: 'Alpha Launch', quarter: 2}, {name: 'Market GA', quarter: 4}],
      summary: plan.strategy || extracted.vision || 'Strategic project initialization and delivery plan.',
      insights: plan.ai_insights || []
    };

  } catch (e) {
    console.error("Critical Roadmap Parsing Error", e);
    return null;
  }
};
