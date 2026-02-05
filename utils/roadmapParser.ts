import { RoadmapData, RoadmapFeature, PriorityLevel, RiskLevel, Status, AIInsight } from '../types';

export const parseRoadmapData = (extractedData: any, roadmapPlan: any): RoadmapData | null => {
  try {
    // Helper to clean and parse if string
    const parse = (input: any) => {
        if (typeof input === 'object') return input;
        const match = input.match(/```json\n([\s\S]*?)\n```/) || input.match(/```json\n([\s\S]*?)$/); // Loose match
        const clean = match ? match[1] : input.replace(/```json/g, '').replace(/```/g, '');
        try { return JSON.parse(clean); } catch { return {}; }
    };

    const extracted = parse(extractedData);
    const plan = parse(roadmapPlan);

    if (!extracted.features || !plan.quarterly_breakdown) {
        console.warn("Missing required fields in parsed data", extracted, plan);
        return null;
    }

    const featuresMap = new Map<string, RoadmapFeature>();

    // 1. Index detailed features from Step 1 (Extracted Data)
    const featuresDetails = extracted.features || [];
    const detailsByName = new Map();
    featuresDetails.forEach((f: any) => detailsByName.set(f.name.toLowerCase(), f));

    // 2. Index intelligent metadata from Step 2 (Plan)
    const metaByName = new Map();
    if (plan.feature_metadata) {
        plan.feature_metadata.forEach((m: any) => metaByName.set(m.name.toLowerCase(), m));
    }

    // 3. Map Quarters and Merge Data
    const processQuarter = (qKey: string, qIdx: number) => {
        const qData = plan.quarterly_breakdown[qKey];
        if (!qData || !qData.features) return;
        
        qData.features.forEach((featName: string) => {
            const lowerName = featName.toLowerCase();
            let feature = featuresMap.get(lowerName);

            if (!feature) {
                // Find details from step 1
                const detail = detailsByName.get(lowerName) || {};
                const meta = metaByName.get(lowerName) || {}; // Intelligence data
                
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

                feature = {
                    id: detail.id || `feat-${Math.random().toString(36).substr(2, 9)}`,
                    name: featName,
                    priority: priority,
                    quarters: [],
                    dependencies: detail.dependencies || [],
                    description: detail.description,
                    effort: detail.estimated_effort,
                    
                    // Intelligent Fields
                    status: status,
                    risk: risk,
                    riskReason: meta.risk_reason,
                    team: meta.assigned_team || 'General',
                    confidence: meta.confidence_score || 80,
                    isCriticalPath: meta.is_critical_path || false
                };
                featuresMap.set(lowerName, feature);
            }
            
            if (!feature.quarters.includes(qIdx)) {
                feature.quarters.push(qIdx);
            }
        });
    };

    processQuarter('Q1', 1);
    processQuarter('Q2', 2);
    processQuarter('Q3', 3);
    processQuarter('Q4', 4);

    // 4. Extract Milestones
    const milestones = [];
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach((q, idx) => {
        const m = plan.quarterly_breakdown[q]?.milestone;
        if (m) milestones.push({ name: m, quarter: idx + 1 });
    });
    if (plan.visualization_data?.milestones) {
        plan.visualization_data.milestones.forEach((m: any) => {
             if (!milestones.find(ex => ex.name === m.name)) {
                 milestones.push({ name: m.name, quarter: typeof m.quarter === 'string' ? parseInt(m.quarter.replace('Q','')) : m.quarter });
             }
        });
    }

    // 5. Extract Insights
    const insights: AIInsight[] = plan.ai_insights || [];

    return {
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