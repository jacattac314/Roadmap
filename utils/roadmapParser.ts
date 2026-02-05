import { RoadmapData, RoadmapFeature, PriorityLevel, RiskLevel, Status, AIInsight, Workstream } from '../types';

export const parseRoadmapData = (extractedData: any, roadmapPlan: any): RoadmapData | null => {
  try {
    // Helper to clean and parse if string
    const parse = (input: any) => {
        if (typeof input === 'object') return input;
        
        // Try standard markdown block first
        const match = input.match(/```json\n([\s\S]*?)\n```/) || input.match(/```json\n([\s\S]*?)$/);
        if (match) {
            try { return JSON.parse(match[1]); } catch (e) {}
        }
        
        // Fallback: finding first { and last } to handle cases where code blocks are missing
        try {
            const clean = input.replace(/```json/g, '').replace(/```/g, ''); // Basic cleanup
            const firstOpen = clean.indexOf('{');
            const lastClose = clean.lastIndexOf('}');
            if (firstOpen !== -1 && lastClose !== -1) {
                return JSON.parse(clean.substring(firstOpen, lastClose + 1));
            }
        } catch (e) {}

        return {};
    };

    const extracted = parse(extractedData);
    const plan = parse(roadmapPlan);

    if (!extracted.features || !plan.workstreams) {
        console.warn("Missing required fields in parsed data", extracted, plan);
        return null;
    }

    // 1. Parse Workstreams
    const workstreams: Workstream[] = (plan.workstreams || []).map((ws: any) => ({
      id: ws.name,
      name: ws.name,
      purpose: ws.purpose || 'No purpose specified.'
    }));

    // Default workstream if needed
    if (workstreams.length === 0) {
      workstreams.push({ id: 'General', name: 'General', purpose: 'General product development.' });
    }

    const featuresMap = new Map<string, RoadmapFeature>();

    // 2. Index detailed features from Step 1 (Extracted Data)
    const featuresDetails = extracted.features || [];
    const detailsByName = new Map();
    featuresDetails.forEach((f: any) => detailsByName.set(f.name.toLowerCase(), f));

    // 3. Index intelligent metadata from Step 2 (Plan)
    const metaByName = new Map();
    if (plan.feature_metadata) {
        plan.feature_metadata.forEach((m: any) => metaByName.set(m.name.toLowerCase(), m));
    }

    // 4. Map Features to Workstreams
    plan.workstreams.forEach((ws: any) => {
      const wsName = ws.name;
      const wsFeatures = ws.features || [];

      wsFeatures.forEach((featName: string) => {
        const lowerName = featName.toLowerCase();
        
        // Don't process duplicates if feature listed in multiple places (take first)
        if (featuresMap.has(lowerName)) return;

        const detail = detailsByName.get(lowerName) || {};
        const meta = metaByName.get(lowerName) || {};
        
        // Map priority string to enum
        let priority: PriorityLevel = 'could_have';
        const p = (detail.priority || '').toLowerCase().replace(' ', '_');
        if (p.includes('must')) priority = 'must_have';
        else if (p.includes('should')) priority = 'should_have';
        else if (p.includes('wont')) priority = 'wont_have';

        // Map risk string to enum
        let risk: RiskLevel = 'low';
        const r = (meta.risk_level || '').toLowerCase();
        if (r.includes('high')) risk = 'high';
        else if (r.includes('medium')) risk = 'medium';

        // Map status string to enum
        let status: Status = 'planned';
        const s = (meta.status || '').toLowerCase();
        if (s.includes('progress')) status = 'in_progress';
        else if (s.includes('completed') || s.includes('done')) status = 'completed';
        else if (s.includes('block')) status = 'blocked';
        else if (s.includes('risk')) status = 'at_risk';

        const feature: RoadmapFeature = {
            id: detail.id || `feat-${Math.random().toString(36).substr(2, 9)}`,
            name: featName,
            priority: priority,
            quarters: meta.assigned_quarters || [], // Use explicit assignment from plan
            dependencies: meta.dependencies || detail.dependencies || [],
            description: detail.description,
            effort: detail.estimated_effort,
            workstream: wsName,
            
            // Intelligent Fields
            status: status,
            risk: risk,
            riskReason: meta.risk_reason,
            team: meta.assigned_team || 'General',
            confidence: meta.confidence_score || 80,
            isCriticalPath: meta.is_critical_path || false,
            predictionRationale: meta.prediction_rationale
        };

        // Fallback quarter assignment if plan missed it but structure implies it
        if (feature.quarters.length === 0) {
           // Simple fallback: assign to Q1 if high priority, else spread
           feature.quarters = feature.priority === 'must_have' ? [1] : [2]; 
        }

        featuresMap.set(lowerName, feature);
      });
    });

    // 5. Extract Milestones (Decision Gates)
    const milestones = [];
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, idx) => {
        const m = plan.quarterly_breakdown[q]?.milestone_gate || plan.quarterly_breakdown[q]?.milestone;
        if (m) milestones.push({ name: m, quarter: idx + 1 });
    });

    // 6. Extract Insights
    const insights: AIInsight[] = plan.ai_insights || [];

    return {
      workstreams: workstreams,
      features: Array.from(featuresMap.values()),
      milestones: milestones,
      summary: plan.strategy || extracted.vision || '',
      insights: insights
    };

  } catch (e) {
    console.error("Error parsing roadmap data", e);
    return null;
  }
};