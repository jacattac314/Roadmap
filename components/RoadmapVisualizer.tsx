import React, { useState, useMemo, useRef } from 'react';
import { RoadmapData, PriorityLevel, RiskLevel, Status } from '../types';
import { Download, ZoomIn, ZoomOut, Filter, Layers, AlertTriangle, Activity, Users, Zap, Brain, X, ListTodo, Diamond, ChevronDown, ChevronRight, CheckCircle2, Circle, Eye, EyeOff } from 'lucide-react';

interface Props {
  data: RoadmapData;
}

// --- CONFIG ---
const QUARTER_WIDTH_BASE = 280;
const SIDEBAR_WIDTH = 260;
const HEADER_HEIGHT = 80;
const GATE_AREA_HEIGHT = 60; // Dedicated area for milestones
const WORKSTREAM_HEADER_HEIGHT = 50;
const FEATURE_BASE_HEIGHT = 44;
const FEATURE_GAP = 12;
const PADDING_TOP = 20;

// Colors - THEME
// Must Have: Terracotta (#CE6764)
// Should Have: Dark Slate (#456365)
// Could Have: Teal (#709E9E)
// Wont Have: Light gray/opacity

const PRIORITY_STYLES: Record<PriorityLevel, { fill: string; opacity: number; stroke: string }> = {
  must_have: { fill: '#CE6764', opacity: 1, stroke: '#456365' },
  should_have: { fill: '#456365', opacity: 1, stroke: '#456365' },
  could_have: { fill: '#709E9E', opacity: 1, stroke: '#456365' },
  wont_have: { fill: '#EFF4DF', opacity: 0.5, stroke: '#456365' }
};

const STATUS_COLORS: Record<string, string> = {
  planned: '#94a3b8',
  in_progress: '#709E9E',
  completed: '#456365',
  blocked: '#CE6764',
  at_risk: '#eab308'
};

const RISK_COLORS: Record<string, string> = {
  high: '#CE6764',
  medium: '#eab308',
  low: '#709E9E'
};

export const RoadmapVisualizer: React.FC<Props> = ({ data }) => {
  // State
  const [zoom, setZoom] = useState(1);
  const [showDeps, setShowDeps] = useState(true);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [showRisks, setShowRisks] = useState(true);
  const [filterPriority, setFilterPriority] = useState<PriorityLevel | 'all'>('all');
  
  const [expandedFeatures, setExpandedFeatures] = useState<Set<string>>(new Set());
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  const QUARTER_WIDTH = QUARTER_WIDTH_BASE * zoom;
  const TOTAL_WIDTH = SIDEBAR_WIDTH + (QUARTER_WIDTH * 4);

  // Toggle Expansion
  const toggleFeature = (id: string) => {
    const newSet = new Set(expandedFeatures);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedFeatures(newSet);
  };

  // --- LAYOUT CALCULATION ---
  const layoutData = useMemo(() => {
    let currentY = HEADER_HEIGHT + GATE_AREA_HEIGHT + PADDING_TOP;
    
    // Group & Sort
    const groups = data.workstreams.map(ws => {
      let features = data.features.filter(f => f.workstream === ws.name);
      
      // Filter
      if (filterPriority !== 'all') {
        features = features.filter(f => f.priority === filterPriority);
      }

      // Sort: Start Quarter -> Priority
      features.sort((a, b) => {
        const startDiff = Math.min(...a.quarters) - Math.min(...b.quarters);
        if (startDiff !== 0) return startDiff;
        const pOrder = ['must_have', 'should_have', 'could_have', 'wont_have'];
        return pOrder.indexOf(a.priority) - pOrder.indexOf(b.priority);
      });

      const startY = currentY;
      currentY += WORKSTREAM_HEADER_HEIGHT;

      // Calculate Nodes
      const featureNodes = features.map(f => {
        const isExpanded = expandedFeatures.has(f.id);
        const y = currentY;
        
        let height = FEATURE_BASE_HEIGHT;
        if (isExpanded) {
           const subtaskHeight = (f.subtasks?.length || 0) * 28;
           const descHeight = f.description ? 40 : 0;
           height += descHeight + subtaskHeight + 20;
        }

        currentY += height + FEATURE_GAP;
        return { ...f, y, height, isExpanded };
      });
      
      currentY += 32; // Group padding

      return {
        ...ws,
        startY,
        endY: currentY - 32,
        features: featureNodes
      };
    });

    return { groups, totalHeight: currentY + 100 };
  }, [data, zoom, expandedFeatures, filterPriority]);

  const getXForQuarter = (q: number) => SIDEBAR_WIDTH + ((q - 1) * QUARTER_WIDTH);

  // Helper for dependency paths
  const getDepPath = (parent: any, child: any) => {
    // Find layout nodes
    let parentNode, childNode;
    layoutData.groups.forEach(g => {
        const p = g.features.find(f => f.id === parent.id);
        if (p) parentNode = p;
        const c = g.features.find(f => f.id === child.id);
        if (c) childNode = c;
    });

    if (!parentNode || !childNode) return '';

    const startX = getXForQuarter(Math.max(...parent.quarters)) + ((Math.max(...parent.quarters) - Math.min(...parent.quarters) + 1) * QUARTER_WIDTH) - 5;
    const startY = parentNode.y + FEATURE_BASE_HEIGHT / 2;
    const endX = getXForQuarter(Math.min(...child.quarters)) + 5;
    const endY = childNode.y + FEATURE_BASE_HEIGHT / 2;

    // Curvy line
    const cp1x = startX + 40;
    const cp2x = endX - 40;
    return `M ${startX} ${startY} C ${cp1x} ${startY}, ${cp2x} ${endY}, ${endX} ${endY}`;
  };

  const handleDownload = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roadmap-viz-${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-full bg-cream overflow-hidden relative font-sans">
      
      {/* --- MAIN VISUALIZER AREA (SCROLLABLE) --- */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        <div className="flex-1 overflow-auto">
             <div style={{ width: TOTAL_WIDTH, height: layoutData.totalHeight }} className="relative bg-white border-2 border-slate shadow-hard m-4 overflow-hidden">
                <svg 
                  ref={svgRef}
                  width={TOTAL_WIDTH} 
                  height={layoutData.totalHeight} 
                  xmlns="http://www.w3.org/2000/svg"
                  className="block font-sans"
                >
                  <defs>
                    <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill="#456365" />
                    </marker>
                    <marker id="arrowhead-critical" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                      <polygon points="0 0, 8 3, 0 6" fill="#CE6764" />
                    </marker>
                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                         <feDropShadow dx="2" dy="2" stdDeviation="0" floodColor="#456365" floodOpacity="1"/>
                    </filter>
                  </defs>

                  {/* 1. BACKGROUND LAYERS */}
                  {/* Quarter Columns */}
                  {[1, 2, 3, 4].map((q) => (
                    <rect 
                        key={q} 
                        x={getXForQuarter(q)} 
                        y={0} 
                        width={QUARTER_WIDTH} 
                        height={layoutData.totalHeight} 
                        fill={q % 2 === 0 ? '#fcfdf9' : '#ffffff'} 
                    />
                  ))}
                  {/* Vertical Lines */}
                  {[1, 2, 3, 4, 5].map((q) => (
                     <line 
                        key={q} 
                        x1={getXForQuarter(q)} 
                        y1={HEADER_HEIGHT} 
                        x2={getXForQuarter(q)} 
                        y2={layoutData.totalHeight} 
                        stroke="#456365" 
                        strokeWidth="1" 
                        strokeDasharray="4 4"
                        opacity="0.2"
                     />
                  ))}

                  {/* 2. HEADERS & MILESTONES (DECISION GATES) */}
                  <rect x="0" y="0" width={TOTAL_WIDTH} height={HEADER_HEIGHT + GATE_AREA_HEIGHT} fill="#EFF4DF" />
                  
                  {[1, 2, 3, 4].map((q) => (
                    <g key={q} transform={`translate(${getXForQuarter(q)}, 0)`}>
                      <text x={QUARTER_WIDTH / 2} y="40" textAnchor="middle" fontSize="24" fontWeight="800" fill="#456365">Q{q}</text>
                      <text x={QUARTER_WIDTH / 2} y="60" textAnchor="middle" fontSize="12" fill="#709E9E" fontWeight="bold" letterSpacing="1">2024</text>
                      
                      {/* DECISION GATE (MILESTONE) */}
                      {data.milestones.filter(m => m.quarter === q).map((m, i) => (
                         <g key={i} transform={`translate(${QUARTER_WIDTH / 2}, ${HEADER_HEIGHT + 20})`}>
                            {/* Vertical Line Drop */}
                            <line x1="0" y1="14" x2="0" y2={layoutData.totalHeight - (HEADER_HEIGHT + 20)} stroke="#CE6764" strokeWidth="2" strokeDasharray="6 4" opacity="0.4" />
                            
                            {/* Diamond */}
                            <polygon points="0,-16 16,0 0,16 -16,0" fill="#CE6764" stroke="#456365" strokeWidth="2" filter="url(#shadow)" />
                            
                            {/* Label */}
                            <text y="-24" textAnchor="middle" fontSize="11" fill="#CE6764" fontWeight="bold" className="uppercase tracking-wide">
                                {m.name}
                            </text>
                         </g>
                      ))}
                    </g>
                  ))}
                  <line x1="0" y1={HEADER_HEIGHT + GATE_AREA_HEIGHT} x2={TOTAL_WIDTH} y2={HEADER_HEIGHT + GATE_AREA_HEIGHT} stroke="#456365" strokeWidth="2" />
                  <line x1={SIDEBAR_WIDTH} y1="0" x2={SIDEBAR_WIDTH} y2={layoutData.totalHeight} stroke="#456365" strokeWidth="2" />


                  {/* 3. CONTENT (WORKSTREAMS & FEATURES) */}
                  {layoutData.groups.map((group) => {
                     return (
                        <g key={group.id}>
                            {/* Workstream Header */}
                            <g transform={`translate(24, ${group.startY + 30})`}>
                                <text fontSize="14" fontWeight="800" fill="#456365" className="uppercase tracking-wider">{group.name}</text>
                                <text y="20" fontSize="11" fill="#709E9E" fontStyle="italic" width={SIDEBAR_WIDTH - 48}>
                                    {group.purpose.substring(0, 40)}{group.purpose.length > 40 ? '...' : ''}
                                </text>
                            </g>
                            
                            <line x1="20" y1={group.endY + 16} x2={TOTAL_WIDTH} y2={group.endY + 16} stroke="#456365" strokeWidth="2" opacity="0.1" />

                            {/* Features */}
                            {group.features.map(feature => {
                               const startQ = Math.min(...feature.quarters);
                               const endQ = Math.max(...feature.quarters);
                               const x = getXForQuarter(startQ) + 8;
                               const width = (endQ - startQ + 1) * QUARTER_WIDTH - 16;
                               
                               const priorityStyle = PRIORITY_STYLES[feature.priority as PriorityLevel];
                               const statusColor = STATUS_COLORS[feature.status];
                               const isExpanded = feature.isExpanded;
                               const isHovered = hoveredFeature === feature.id;

                               // For "Must Have", use filled color. For others, maybe outlines or lighter fills?
                               // Keeping styling consistent with geometric theme: Solid fills, thick borders.

                               return (
                                 <g 
                                    key={feature.id} 
                                    onClick={() => toggleFeature(feature.id)} 
                                    onMouseEnter={() => setHoveredFeature(feature.id)}
                                    onMouseLeave={() => setHoveredFeature(null)}
                                    className="cursor-pointer transition-opacity"
                                    style={{ opacity: (filterPriority !== 'all' && feature.priority !== filterPriority) ? 0.3 : 1 }}
                                 >
                                    {/* Main Bar */}
                                    <rect 
                                        x={x} 
                                        y={feature.y} 
                                        width={width} 
                                        height={feature.height} 
                                        fill={isExpanded ? '#ffffff' : priorityStyle.fill}
                                        stroke="#456365"
                                        strokeWidth="2"
                                        filter={isHovered ? "url(#shadow)" : ""}
                                    />

                                    {/* Header Strip (if expanded) - color code the top */}
                                    {isExpanded && (
                                       <rect 
                                            x={x} 
                                            y={feature.y} 
                                            width={width} 
                                            height={FEATURE_BASE_HEIGHT} 
                                            fill={priorityStyle.fill}
                                            stroke="none"
                                       />
                                    )}

                                    {/* Text */}
                                    <text 
                                        x={x + 36} 
                                        y={feature.y + 26} 
                                        fontSize="13" 
                                        fontWeight="bold" 
                                        fill={isExpanded ? "#white" : (feature.priority === 'must_have' || feature.priority === 'should_have' ? '#ffffff' : '#456365')}
                                    >
                                        {feature.name}
                                    </text>

                                    {/* Expand Icon */}
                                    <foreignObject x={x + 10} y={feature.y + 12} width="20" height="20" className="pointer-events-none">
                                       <div className={`text-${isExpanded ? 'white' : (feature.priority === 'must_have' || feature.priority === 'should_have' ? 'white' : 'slate')}`}>
                                          {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                       </div>
                                    </foreignObject>

                                    {/* Badges */}
                                    <g transform={`translate(${x + width - 12}, ${feature.y + FEATURE_BASE_HEIGHT / 2})`}>
                                        {feature.risk === 'high' && showRisks && (
                                            <g transform="translate(-90, -9)">
                                                <rect width="80" height="18" fill="#ffffff" stroke="#CE6764" strokeWidth="2" />
                                                <text x="40" y="13" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#CE6764">RISK</text>
                                            </g>
                                        )}
                                    </g>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                       <foreignObject x={x + 20} y={feature.y + FEATURE_BASE_HEIGHT} width={width - 40} height={feature.height - FEATURE_BASE_HEIGHT - 5}>
                                          <div className="pt-3">
                                             {feature.description && (
                                               <p className="text-xs text-slate font-medium mb-3 leading-relaxed border-l-2 border-teal pl-2">{feature.description}</p>
                                             )}
                                             {feature.subtasks && feature.subtasks.length > 0 && (
                                                <div className="space-y-1">
                                                  {feature.subtasks.map((task, idx) => (
                                                     <div key={idx} className="flex items-center gap-2 text-xs p-1 border border-slate/10 bg-cream/50">
                                                        {task.status === 'completed' ? <CheckCircle2 size={14} className="text-teal" /> : <Circle size={14} className="text-slate" />}
                                                        <span className={`uppercase font-bold ${task.status === 'completed' ? 'text-slate/50 line-through' : 'text-slate'}`}>{task.name}</span>
                                                     </div>
                                                  ))}
                                                </div>
                                             )}
                                          </div>
                                       </foreignObject>
                                    )}
                                 </g>
                               );
                            })}
                        </g>
                     );
                  })}

                  {/* 4. DEPENDENCY LINES (TOP LAYER) */}
                  {showDeps && data.features.flatMap(feature => {
                      if (!feature.dependencies) return [];
                      return feature.dependencies.map(depName => {
                         const parent = data.features.find(p => p.name.toLowerCase().includes(depName.toLowerCase()));
                         if (!parent) return null;
                         const path = getDepPath(parent, feature);
                         if (!path) return null;
                         
                         const isCrit = showCriticalPath && feature.isCriticalPath && parent.isCriticalPath;

                         return (
                            <path 
                                key={`${parent.id}-${feature.id}`}
                                d={path}
                                fill="none"
                                stroke={isCrit ? '#CE6764' : '#456365'}
                                strokeWidth={isCrit ? 3 : 2}
                                strokeDasharray={isCrit ? '0' : '4 4'}
                                markerEnd={isCrit ? "url(#arrowhead-critical)" : "url(#arrowhead)"}
                            />
                         );
                      });
                  })}

                </svg>
             </div>
        </div>
      </div>

      {/* --- RIGHT CONTROL SIDEBAR --- */}
      <div className="w-72 bg-cream border-l-2 border-slate p-6 flex flex-col gap-8 shadow-2xl z-10">
         <div>
            <h3 className="text-xs font-bold text-slate uppercase tracking-widest mb-4 border-b-2 border-slate pb-2">View Controls</h3>
            <div className="space-y-3">
                <label className="flex items-center gap-3 text-sm text-slate font-bold cursor-pointer group">
                    <div className={`w-5 h-5 border-2 border-slate flex items-center justify-center transition-colors ${showDeps ? 'bg-teal' : 'bg-white'}`}>
                        {showDeps && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={showDeps} onChange={(e) => setShowDeps(e.target.checked)} className="hidden" />
                    <span>Show Dependencies</span>
                </label>
                <label className="flex items-center gap-3 text-sm text-slate font-bold cursor-pointer group">
                    <div className={`w-5 h-5 border-2 border-slate flex items-center justify-center transition-colors ${showCriticalPath ? 'bg-terra' : 'bg-white'}`}>
                        {showCriticalPath && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <input type="checkbox" checked={showCriticalPath} onChange={(e) => setShowCriticalPath(e.target.checked)} className="hidden" />
                    <span className={showCriticalPath ? "text-terra" : ""}>Highlight Critical</span>
                </label>
            </div>
         </div>

         <div>
             <h3 className="text-xs font-bold text-slate uppercase tracking-widest mb-4 border-b-2 border-slate pb-2">Filter Priority</h3>
             <div className="space-y-2">
                {['all', 'must_have', 'should_have', 'could_have'].map((p) => (
                    <button 
                        key={p}
                        onClick={() => setFilterPriority(p as any)}
                        className={`w-full text-left px-3 py-2 border-2 text-xs font-bold uppercase transition-all flex items-center gap-3 ${filterPriority === p ? 'bg-white border-slate shadow-hard-sm translate-x-[-2px] translate-y-[-2px]' : 'border-transparent hover:bg-white hover:border-slate/50 text-slate/70'}`}
                    >
                        <div className={`w-3 h-3 rounded-full border border-slate`} style={{ backgroundColor: p !== 'all' ? PRIORITY_STYLES[p as PriorityLevel].fill : '#ccc' }} />
                        {p === 'all' ? 'All Priorities' : p.replace('_', ' ')}
                    </button>
                ))}
             </div>
         </div>

         <div className="mt-auto">
            <h3 className="text-xs font-bold text-teal uppercase tracking-widest mb-3 flex items-center gap-2">
                <Brain size={16} /> AI Summary
            </h3>
            <div className="bg-white border-2 border-slate p-4 text-xs text-slate font-medium leading-relaxed shadow-hard-sm">
                {data.insights?.[0]?.description || "No specific insights generated."}
            </div>
            <button onClick={handleDownload} className="w-full mt-6 flex items-center justify-center gap-2 px-4 py-3 border-2 border-slate bg-slate text-white font-bold hover:bg-teal transition-colors shadow-hard uppercase text-xs tracking-widest">
                <Download size={16} /> Export SVG
            </button>
         </div>
      </div>

    </div>
  );
};