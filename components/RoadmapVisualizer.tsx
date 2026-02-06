
import React, { useState, useMemo, useRef } from 'react';
import { RoadmapData, PriorityLevel, RiskLevel, Status } from '../types';
import { Download, CheckCircle2, Circle, ChevronDown, ChevronRight, AlertTriangle, Calendar, Clock } from 'lucide-react';

interface Props {
  data: RoadmapData;
}

// --- CONFIG ---
const QUARTER_WIDTH_BASE = 300;
const SIDEBAR_WIDTH = 280;
const HEADER_HEIGHT = 100;
const ROW_HEIGHT = 64;
const ROW_GAP = 12;

// --- THEME CONSTANTS ---
const COLORS = {
  bg: '#09090B',       // Zinc 950
  grid: '#27272A',     // Zinc 800
  text: '#FAFAFA',     // Zinc 50
  textDim: '#71717A',  // Zinc 500
  accent: '#10B981',   // Emerald 500 (For "Now" line)
  
  // Bar Styles
  barLight: '#FFFFFF',
  barDark: '#27272A',
  barGradientStart: '#2DD4BF', // Teal 400
  barGradientEnd: '#0F766E',   // Teal 700
};

export const RoadmapVisualizer: React.FC<Props> = ({ data }) => {
  const [zoom, setZoom] = useState(1);
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);

  const QUARTER_WIDTH = QUARTER_WIDTH_BASE * zoom;
  const TOTAL_WIDTH = SIDEBAR_WIDTH + (QUARTER_WIDTH * 4);

  // Helper to determine bar style based on status/priority
  const getBarStyle = (feature: any) => {
    // "Development" or "In Progress" gets the gradient
    if (feature.status === 'in_progress' || feature.name.toLowerCase().includes('development') || feature.name.toLowerCase().includes('implementation')) {
      return { fill: 'url(#gradient-dev)', text: '#FFFFFF', badgeBg: 'rgba(0,0,0,0.3)', badgeText: '#fff' };
    }
    // "Research", "Testing", "Design" gets white/light
    if (feature.name.toLowerCase().includes('research') || feature.name.toLowerCase().includes('design') || feature.name.toLowerCase().includes('testing')) {
      return { fill: '#FFFFFF', text: '#09090B', badgeBg: '#09090B', badgeText: '#fff' };
    }
    // Default / Planned gets Dark
    return { fill: '#27272A', text: '#FFFFFF', badgeBg: '#52525B', badgeText: '#fff' };
  };

  const layoutData = useMemo(() => {
    let currentY = HEADER_HEIGHT + 20;
    
    // Group features by workstream
    const groups = data.workstreams.map(ws => {
      const features = data.features.filter(f => f.workstream === ws.name);
      
      // Sort by start quarter
      features.sort((a, b) => Math.min(...a.quarters) - Math.min(...b.quarters));

      const groupStartY = currentY;
      
      // Calculate feature positions
      const featureNodes = features.map(f => {
        const isExpanded = expandedFeatures.has(f.id);
        const y = currentY;
        
        let height = ROW_HEIGHT;
        if (isExpanded) {
           const subtaskHeight = (f.subtasks?.length || 0) * 32;
           height += subtaskHeight + 20;
        }

        currentY += height + ROW_GAP;
        return { ...f, y, height, isExpanded };
      });
      
      currentY += 40; // Gap between groups

      return {
        ...ws,
        features: featureNodes,
        startY: groupStartY
      };
    });

    return { groups, totalHeight: currentY + 100 };
  }, [data, zoom, expandedFeatures]);

  const toggleFeature = (id: string) => {
    const newSet = new Set(expandedFeatures);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedFeatures(newSet);
  };

  const handleDownload = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roadmap-dark-${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to get quarter label
  const getQuarterLabel = (q: number) => {
    const months = ['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'];
    return { q: `Q${q}`, m: months[q-1] };
  };

  // Calculate "Now" position (approximate Q1/Q2 boundary for demo)
  const nowX = SIDEBAR_WIDTH + (QUARTER_WIDTH * 1.3); 

  return (
    <div className="flex flex-col h-full bg-[#09090B] text-white font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#09090B] shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workflow plan</h2>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest mt-1">Generated Roadmap</p>
        </div>
        <div className="flex gap-4">
           <button onClick={handleDownload} className="flex items-center gap-2 px-4 py-2 bg-white text-black text-xs font-bold uppercase rounded-full hover:bg-zinc-200 transition-colors">
              <Download size={14} /> Export
           </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto relative custom-scrollbar">
        <div style={{ width: TOTAL_WIDTH, height: layoutData.totalHeight }} className="relative">
           <svg 
              ref={svgRef}
              width={TOTAL_WIDTH} 
              height={layoutData.totalHeight} 
              xmlns="http://www.w3.org/2000/svg"
              className="block"
            >
              <defs>
                <linearGradient id="gradient-dev" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={COLORS.barGradientStart} />
                  <stop offset="100%" stopColor={COLORS.barGradientEnd} />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>

              {/* 1. BACKGROUND GRID */}
              {[1, 2, 3, 4].map((q) => {
                 const x = SIDEBAR_WIDTH + ((q - 1) * QUARTER_WIDTH);
                 return (
                   <g key={q}>
                      {/* Vertical separator */}
                      <line x1={x} y1={0} x2={x} y2={layoutData.totalHeight} stroke={COLORS.grid} strokeWidth="1" strokeDasharray="4 4" />
                      
                      {/* Quarter Header */}
                      <text x={x + 20} y="40" fill={COLORS.textDim} fontSize="12" fontWeight="600" letterSpacing="1">{getQuarterLabel(q).m}</text>
                      <text x={x + 20} y="60" fill={COLORS.text} fontSize="18" fontWeight="bold">{getQuarterLabel(q).q}</text>
                   </g>
                 );
              })}

              {/* NOW INDICATOR */}
              <line x1={nowX} y1={20} x2={nowX} y2={layoutData.totalHeight} stroke={COLORS.accent} strokeWidth="2" strokeDasharray="6 4" />
              <g transform={`translate(${nowX - 24}, 30)`}>
                 <rect width="48" height="24" rx="12" fill={COLORS.accent} />
                 <text x="24" y="16" textAnchor="middle" fill="#000" fontSize="10" fontWeight="bold">Now</text>
                 <polygon points="24,24 18,29 30,29" fill={COLORS.accent} transform="translate(0, -5)" />
              </g>

              {/* 2. WORKSTREAMS & FEATURES */}
              {layoutData.groups.map(group => (
                <g key={group.id}>
                  {/* Workstream Label (Sidebar) */}
                  <g transform={`translate(24, ${group.startY + 40})`}>
                     <text fill={COLORS.text} fontSize="14" fontWeight="bold" letterSpacing="0.5">{group.name}</text>
                     <text y="20" fill={COLORS.textDim} fontSize="11">{group.features.length} tasks</text>
                  </g>

                  {/* Features */}
                  {group.features.map(feature => {
                     const startQ = Math.min(...feature.quarters);
                     const endQ = Math.max(...feature.quarters);
                     const x = SIDEBAR_WIDTH + ((startQ - 1) * QUARTER_WIDTH) + 20;
                     // Span across quarters, slightly shorter width for aesthetics
                     const width = ((endQ - startQ + 1) * QUARTER_WIDTH) - 40;
                     
                     const style = getBarStyle(feature);
                     const isHovered = false; // Simplified for SVG

                     return (
                       <g 
                          key={feature.id} 
                          onClick={() => toggleFeature(feature.id)} 
                          className="cursor-pointer hover:opacity-90 transition-opacity"
                       >
                          {/* Main Bar */}
                          <rect 
                            x={x} 
                            y={feature.y} 
                            width={width} 
                            height={ROW_HEIGHT} 
                            rx="12"
                            fill={style.fill} 
                            filter={feature.name.toLowerCase().includes('development') ? "url(#glow)" : ""}
                          />
                          
                          {/* Label */}
                          <text 
                            x={x + 24} 
                            y={feature.y + 36} 
                            fill={style.text} 
                            fontSize="14" 
                            fontWeight="600"
                            style={{ pointerEvents: 'none' }}
                          >
                            {feature.name}
                          </text>

                          {/* Duration/Status Badge */}
                          <g transform={`translate(${x + width - 70}, ${feature.y + 20})`}>
                             <rect width="50" height="24" rx="6" fill={style.badgeBg} />
                             <text x="25" y="16" textAnchor="middle" fill={style.badgeText} fontSize="10" fontWeight="bold">
                               {endQ - startQ + 1} Qtrs
                             </text>
                          </g>

                          {/* Risk Badge if High */}
                          {feature.risk === 'high' && (
                             <g transform={`translate(${x + width + 10}, ${feature.y + 32})`}>
                                <circle r="12" fill="#EF4444" opacity="0.2" />
                                <circle r="3" fill="#EF4444" />
                             </g>
                          )}

                          {/* Expanded Subtasks */}
                          {feature.isExpanded && (
                             <g transform={`translate(${x}, ${feature.y + ROW_HEIGHT})`}>
                                <line x1="20" y1="0" x2="20" y2={feature.height - ROW_HEIGHT - 10} stroke={COLORS.grid} strokeWidth="2" />
                                {feature.subtasks?.map((task, i) => (
                                   <g key={i} transform={`translate(40, ${(i * 32) + 20})`}>
                                      <circle r="4" fill={task.status === 'completed' ? COLORS.accent : COLORS.grid} />
                                      <text x="16" y="4" fill={COLORS.textDim} fontSize="12">{task.name}</text>
                                   </g>
                                ))}
                             </g>
                          )}
                       </g>
                     );
                  })}
                </g>
              ))}

           </svg>
        </div>
      </div>
    </div>
  );
};
