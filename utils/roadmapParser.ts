import { RoadmapData, RoadmapFeature, PriorityLevel } from '../types';

export const parseRoadmapData = (prioritiesJson: string, timelineJson: string): RoadmapData | null => {
  try {
    // 1. Clean and Parse JSONs (Handle potential markdown code blocks from Gemini)
    const cleanJson = (str: string) => {
      const match = str.match(/```json\n([\s\S]*?)\n```/);
      return match ? match[1] : str.replace(/```json/g, '').replace(/```/g, '');
    };

    const priorities = JSON.parse(cleanJson(prioritiesJson));
    const timeline = JSON.parse(cleanJson(timelineJson));

    const featuresMap = new Map<string, RoadmapFeature>();

    // 2. Helper to find priority of a feature name
    const findPriority = (name: string): PriorityLevel => {
      const lowerName = name.toLowerCase();
      if (priorities.must_have?.some((f: any) => f.title?.toLowerCase().includes(lowerName) || f.name?.toLowerCase().includes(lowerName))) return 'must_have';
      if (priorities.should_have?.some((f: any) => f.title?.toLowerCase().includes(lowerName) || f.name?.toLowerCase().includes(lowerName))) return 'should_have';
      if (priorities.could_have?.some((f: any) => f.title?.toLowerCase().includes(lowerName) || f.name?.toLowerCase().includes(lowerName))) return 'could_have';
      return 'wont_have';
    };
    
    // 3. Helper to find dependencies
    const findDependencies = (name: string): string[] => {
        const deps = priorities.feature_dependencies || [];
        // flexible matching
        const entry = deps.find((d: any) => 
            (d.feature && d.feature.toLowerCase().includes(name.toLowerCase())) ||
            (d.name && d.name.toLowerCase().includes(name.toLowerCase()))
        );
        return entry ? (entry.depends_on || entry.dependencies || []) : [];
    };

    // 4. Process Timeline Quarters
    const processQuarter = (quarterFeatures: any[], quarterIdx: number) => {
      if (!Array.isArray(quarterFeatures)) return;
      
      quarterFeatures.forEach((feat: any) => {
        const name = typeof feat === 'string' ? feat : (feat.title || feat.name || 'Unknown Feature');
        
        if (featuresMap.has(name)) {
          // Extend existing feature duration
          const existing = featuresMap.get(name)!;
          if (!existing.quarters.includes(quarterIdx)) {
            existing.quarters.push(quarterIdx);
            existing.quarters.sort();
          }
        } else {
          // Create new feature
          featuresMap.set(name, {
            id: `feat-${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            priority: findPriority(name),
            quarters: [quarterIdx],
            dependencies: findDependencies(name),
            description: typeof feat === 'object' ? feat.description : undefined
          });
        }
      });
    };

    processQuarter(timeline.q1_features, 1);
    processQuarter(timeline.q2_features, 2);
    processQuarter(timeline.q3_features, 3);
    processQuarter(timeline.q4_features, 4);

    // 5. Extract Milestones from narrative (simple heuristic)
    const milestones: { name: string; quarter: number }[] = [];
    const extractMilestones = (text: string, q: number) => {
       if(!text) return;
       const sentences = text.split('.');
       sentences.forEach(s => {
         if (s.toLowerCase().includes('milestone') || s.toLowerCase().includes('release') || s.toLowerCase().includes('launch')) {
            milestones.push({ name: s.trim().slice(0, 50) + (s.length > 50 ? '...' : ''), quarter: q });
         }
       });
    };

    extractMilestones(timeline.q1_narrative, 1);
    extractMilestones(timeline.q2_narrative, 2);
    extractMilestones(timeline.q3_narrative, 3);
    extractMilestones(timeline.q4_narrative, 4);

    return {
      features: Array.from(featuresMap.values()),
      milestones,
      summary: timeline.high_level_strategy || ''
    };

  } catch (e) {
    console.error("Error parsing roadmap data", e);
    return null;
  }
};