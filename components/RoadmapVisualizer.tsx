import React, { useState, useMemo, useRef } from 'react';
import { RoadmapData, PriorityLevel, RiskLevel, Status } from '../types';
import { Download, ZoomIn, ZoomOut, Filter, Layers, AlertTriangle, Activity, Users, Zap, Brain, X, ListTodo, Diamond } from 'lucide-react';

interface Props {
  data: RoadmapData;
}

// Color Maps
const PRIORITY_COLORS = {
  must_have: '#EF4444',
  should_have: '#F97316',
  could_have: '#EAB308',
  wont_have: '#22C55E'
};

const RISK_COLORS = {
  high: '#DC2626',
  medium: '#F59E0B',
  low: '#10B981'
};

const STATUS_COLORS = {
  planned: '#94a3b8',
  in_progress: '#3b82f6',
  completed: '#10b981',
  blocked: '#ef4444',
  at_risk: '#f59e0b'
};

const LABELS_STATUS: Record<string, string> = {
  planned: 'Planned',
  in_progress: 'In Progress',
  completed: 'Done',
  blocked: 'Blocked',
  at_risk: 'At Risk'
};

const CONFIDENCE_LABELS = (score: number) => {
  if (score >= 80) return { label: 'High Confidence', color: '#10B981', text: 'HC' };
  if (score >= 50) return { label: 'Medium Confidence', color: '#F59E0B', text: 'MC' };
  return { label: 'Low Confidence', color: '#EF4444', text: 'LC' };
};

type ViewMode = 'priority' | 'risk' | 'status';

export const RoadmapVisualizer: React.FC<Props> = ({ data }) => {
  const [zoom, setZoom] = useState(1);
  const [showDeps, setShowDeps] = useState(true);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('status');
  const [showInsights, setShowInsights] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);

  // Layout Constants
  const QUARTER_WIDTH = 300 * zoom;
  const HEADER_HEIGHT = 100;
  const SIDEBAR_WIDTH = 320;
  const TOTAL_WIDTH = SIDEBAR_WIDTH + (QUARTER_WIDTH * 4);
  
  const WORKSTREAM_HEADER_HEIGHT = 40;
  const FEATURE_HEIGHT = 40;
  const FEATURE_GAP = 8;
  const PADDING_TOP = 20;

  // Process Data for Layout
  const layoutData = useMemo(() => {
    let currentY = HEADER_HEIGHT + PADDING_TOP;
    
    // Group features by workstream
    const workstreamGroups = data.workstreams.map(ws => {
      const features = data.features.filter(f => f.workstream === ws.name);
      // Sort features by start quarter
      features.sort((a, b) => Math.min(...a.quarters) - Math.min(...b.quarters));
      
      const startY = currentY;
      
      // Calculate workstream bar dimensions
      // Workstream bar spans the min start quarter to max end quarter of its children
      let wsMinQ = 5;
      let wsMaxQ = 0;
      
      if (features.length > 0) {
        features.forEach(f => {
          wsMinQ = Math.min(wsMinQ, Math.min(...f.quarters));
          wsMaxQ = Math.max(wsMaxQ, Math.max(...f.quarters));
        });
      } else {
         wsMinQ = 1; wsMaxQ = 1; // Default placeholders
      }

      currentY += WORKSTREAM_HEADER_HEIGHT; // Space for the big bar title/bar

      const featureNodes = features.map(f => {
        const y = currentY;
        currentY += FEATURE_HEIGHT + FEATURE_GAP;
        return { ...f, y, height: FEATURE_HEIGHT };
      });
      
      currentY += 20; // Padding after workstream group

      return {
        ...ws,
        minQ: wsMinQ,
        maxQ: wsMaxQ,
        startY,
        endY: currentY - 20,
        features: featureNodes
      };
    });

    return { groups: workstreamGroups, totalHeight: currentY };
  }, [data, zoom]);

  const getXForQuarter = (q: number) => SIDEBAR_WIDTH + ((q - 1) * QUARTER_WIDTH);

  const getBarColor = (feature: any) => {
    if (viewMode === 'risk') return RISK_COLORS[feature.risk as RiskLevel] || RISK_COLORS.low;
    if (viewMode === 'status') return STATUS_COLORS[feature.status as Status] || STATUS_COLORS.planned;
    return PRIORITY_COLORS[feature.priority as PriorityLevel];
  };

  const handleDownload = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roadmap-workstreams-${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="h-16 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50/50 shrink-0">
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-white rounded-md border border-gray-200 p-1 shrink-0">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ZoomOut size={16} /></button>
              <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="p-1.5 hover:bg-gray-100 rounded text-gray-600"><ZoomIn size={16} /></button>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            {/* View Modes */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg shrink-0">
               <button 
                 onClick={() => setViewMode('priority')}
                 className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'priority' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
               >
                 <Filter size={14} /> Priority
               </button>
               <button 
                 onClick={() => setViewMode('status')}
                 className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'status' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
               >
                 <ListTodo size={14} /> Status
               </button>
               <button 
                 onClick={() => setViewMode('risk')}
                 className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'risk' ? 'bg-white shadow-sm text-rose-600' : 'text-gray-500 hover:text-gray-900'}`}
               >
                 <AlertTriangle size={14} /> Risk
               </button>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            <button 
              onClick={() => setShowDeps(!showDeps)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${showDeps ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Layers size={14} /> Deps
            </button>
            
            <button 
              onClick={() => setShowCriticalPath(!showCriticalPath)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${showCriticalPath ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Activity size={14} /> Critical Path
            </button>

             <button 
              onClick={() => setShowInsights(!showInsights)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ml-auto ${showInsights ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              <Brain size={14} /> AI Insights
              <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-bold">
                 {data.insights.length}
              </div>
            </button>
          </div>

          <button onClick={handleDownload} className="ml-4 p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md">
            <Download size={18} />
          </button>
        </div>

        {/* Visualization Area */}
        <div className="flex-1 overflow-auto bg-gray-50 relative">
          <div style={{ width: TOTAL_WIDTH, height: layoutData.totalHeight }} className="relative bg-white shadow-sm m-4">
            
            <svg 
              ref={svgRef}
              width={TOTAL_WIDTH} 
              height={layoutData.totalHeight} 
              xmlns="http://www.w3.org/2000/svg"
              className="block"
            >
              <defs>
                <pattern id="grid" width={QUARTER_WIDTH} height="20" patternUnits="userSpaceOnUse">
                  <path d={`M ${QUARTER_WIDTH} 0 L ${QUARTER_WIDTH} 20`} fill="none" stroke="#f1f5f9" strokeWidth="1" />
                </pattern>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
                <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
                </marker>
                 <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.1"/>
                </filter>
              </defs>

              {/* Quarter Columns Background */}
              {[1, 2, 3, 4].map((q) => (
                <rect 
                    key={q} 
                    x={getXForQuarter(q)} 
                    y={0} 
                    width={QUARTER_WIDTH} 
                    height={layoutData.totalHeight} 
                    fill={q % 2 === 0 ? '#f8fafc' : '#ffffff'} 
                />
              ))}

              {/* Vertical Grid Lines */}
              {[1, 2, 3, 4, 5].map((q) => (
                 <line 
                    key={q} 
                    x1={getXForQuarter(q)} 
                    y1={HEADER_HEIGHT} 
                    x2={getXForQuarter(q)} 
                    y2={layoutData.totalHeight} 
                    stroke="#e2e8f0" 
                    strokeWidth="1" 
                    strokeDasharray="4 4"
                 />
              ))}

              {/* Header Section */}
              <rect x="0" y="0" width={TOTAL_WIDTH} height={HEADER_HEIGHT} fill="#ffffff" />
              <line x1="0" y1={HEADER_HEIGHT} x2={TOTAL_WIDTH} y2={HEADER_HEIGHT} stroke="#cbd5e1" strokeWidth="2" />
              <line x1={SIDEBAR_WIDTH} y1="0" x2={SIDEBAR_WIDTH} y2={layoutData.totalHeight} stroke="#cbd5e1" strokeWidth="2" />

              {/* Quarter Labels */}
              {[1, 2, 3, 4].map((q) => (
                <g key={q} transform={`translate(${getXForQuarter(q)}, 0)`}>
                  <text x={QUARTER_WIDTH / 2} y="35" textAnchor="middle" fontSize="18" fontWeight="800" fill="#1e293b">Q{q}</text>
                  
                  {/* Decision Gate (Milestone) */}
                  {data.milestones.filter(m => m.quarter === q).map((m, i) => (
                     <g key={i} transform={`translate(${QUARTER_WIDTH / 2}, 65)`}>
                        {/* Diamond Shape */}
                        <polygon points="0,-10 10,0 0,10 -10,0" fill="#7c3aed" stroke="white" strokeWidth="2" />
                        
                        {/* Vertical Drop Line */}
                        <line x1="0" y1="10" x2="0" y2={layoutData.totalHeight - 65} stroke="#7c3aed" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
                        
                        <text y="-18" textAnchor="middle" fontSize="11" fill="#6d28d9" fontWeight="bold" className="uppercase tracking-wide">
                            GATE: {m.name}
                        </text>
                     </g>
                  ))}
                </g>
              ))}

              {/* Workstream Groups */}
              {layoutData.groups.map((group) => {
                 const wsStartX = getXForQuarter(group.minQ);
                 const wsWidth = (group.maxQ - group.minQ + 1) * QUARTER_WIDTH;

                 return (
                    <g key={group.id}>
                        {/* Workstream Sidebar Header */}
                        <g transform={`translate(20, ${group.startY + 20})`}>
                            <text fontSize="14" fontWeight="800" fill="#334155" className="uppercase tracking-wide">{group.name}</text>
                            <text y="20" fontSize="11" fill="#64748b" fontStyle="italic" width={SIDEBAR_WIDTH - 40}>
                                {group.purpose.length > 40 ? group.purpose.substring(0, 40) + '...' : group.purpose}
                            </text>
                            <title>{group.purpose}</title>
                        </g>

                        {/* Workstream Summary Bar (Track) */}
                        <rect 
                            x={getXForQuarter(1)} 
                            y={group.startY} 
                            width={QUARTER_WIDTH * 4} 
                            height={group.endY - group.startY} 
                            fill="none" 
                            stroke="#e2e8f0" 
                            strokeWidth="1" 
                            rx="4"
                            opacity="0.5"
                        />
                         
                         {/* Major Workstream Bar Visual */}
                        <rect
                             x={wsStartX}
                             y={group.startY + 5}
                             width={wsWidth}
                             height="6"
                             fill="#cbd5e1"
                             rx="3"
                        />

                        {/* Features (Tasks) */}
                        {group.features.map(feature => {
                           const startQ = Math.min(...feature.quarters);
                           const endQ = Math.max(...feature.quarters);
                           const x = getXForQuarter(startQ) + 10;
                           const width = (endQ - startQ + 1) * QUARTER_WIDTH - 20;
                           const color = getBarColor(feature);
                           const conf = CONFIDENCE_LABELS(feature.confidence);

                           return (
                             <g key={feature.id} className="group cursor-pointer">
                                {/* Bar */}
                                <rect 
                                    x={x} 
                                    y={feature.y} 
                                    width={width} 
                                    height={FEATURE_HEIGHT} 
                                    rx="6" 
                                    fill="white" 
                                    stroke={color} 
                                    strokeWidth="2"
                                    filter="url(#shadow)"
                                />
                                
                                {/* Fill Indicator (Left Border) */}
                                <path d={`M ${x+4} ${feature.y+2} L ${x+4} ${feature.y + FEATURE_HEIGHT - 2}`} stroke={color} strokeWidth="4" strokeLinecap="round" />

                                {/* Label */}
                                <text x={x + 15} y={feature.y + 18} fontSize="12" fontWeight="600" fill="#1e293b">
                                    {feature.name}
                                </text>

                                {/* Badges (Right Aligned) */}
                                <g transform={`translate(${x + width - 10}, ${feature.y + FEATURE_HEIGHT / 2})`}>
                                    {/* Confidence Badge */}
                                    <rect x="-30" y="-8" width="24" height="16" rx="4" fill={conf.color} />
                                    <text x="-18" y="3" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white">{conf.text}</text>
                                    
                                    {/* Status Icon/Text */}
                                    <text x="-36" y="4" textAnchor="end" fontSize="10" fontWeight="500" fill="#64748b" className="uppercase">
                                        {LABELS_STATUS[feature.status]}
                                    </text>
                                </g>

                                {/* Tooltip Logic via Title for simplicity */}
                                <title>
                                    {feature.name}
                                    &#10;Status: {LABELS_STATUS[feature.status]}
                                    &#10;Confidence: {feature.confidence}% ({feature.predictionRationale || 'Based on historic data'})
                                    &#10;Effort: {feature.effort}/10
                                </title>
                             </g>
                           );
                        })}
                    </g>
                 );
              })}

              {/* Dependencies Layer (On Top) */}
              {showDeps && data.features.flatMap(feature => {
                  const parent = data.features.find(p => feature.dependencies?.some(d => p.name.toLowerCase().includes(d.toLowerCase())));
                  if (!parent) return [];
                  
                  // Need correct Y coordinates, which are inside layoutData
                  const featureNode = layoutData.groups.flatMap(g => g.features).find(f => f.id === feature.id);
                  const parentNode = layoutData.groups.flatMap(g => g.features).find(f => f.id === parent.id);
                  
                  if (!featureNode || !parentNode) return [];

                  const startX = getXForQuarter(Math.max(...parent.quarters)) + ((Math.max(...parent.quarters) - Math.min(...parent.quarters) + 1) * QUARTER_WIDTH) - 10;
                  const startY = parentNode.y + FEATURE_HEIGHT / 2;
                  
                  const endX = getXForQuarter(Math.min(...feature.quarters)) + 10;
                  const endY = featureNode.y + FEATURE_HEIGHT / 2;

                  const isCritical = showCriticalPath && feature.isCriticalPath && parent.isCriticalPath;

                  return (
                      <path 
                        key={`dep-${parent.id}-${feature.id}`}
                        d={`M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`}
                        fill="none"
                        stroke={isCritical ? '#EF4444' : '#94a3b8'}
                        strokeWidth={isCritical ? 2 : 1.5}
                        strokeDasharray={isCritical ? '0' : '4 2'}
                        markerEnd={isCritical ? "url(#arrowhead-critical)" : "url(#arrowhead)"}
                      />
                  );
              })}

            </svg>
          </div>
        </div>
        
        {/* Legend */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-6 text-xs overflow-x-auto">
             <div className="flex items-center gap-2">
                 <Diamond size={12} fill="#7c3aed" className="text-purple-600" />
                 <span className="font-semibold text-purple-700">Decision Gate</span>
             </div>
             
             <div className="h-4 w-px bg-gray-300 mx-2" />

             <span className="font-medium text-gray-500">Confidence:</span>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-[#10B981]"></div> HC (High)</div>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-[#F59E0B]"></div> MC (Med)</div>
             <div className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-[#EF4444]"></div> LC (Low)</div>
             
             <div className="h-4 w-px bg-gray-300 mx-2" />
             
             <span className="font-medium text-gray-500">Workstreams are grouped horizontally.</span>
        </div>
      </div>

      {/* AI Insights Sidebar */}
      <div className={`w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto transition-all duration-300 absolute right-0 top-14 bottom-0 z-20 shadow-xl ${showInsights ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Brain size={18} className="text-amber-500" />
              AI Intelligence
            </h3>
            <button onClick={() => setShowInsights(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4">
            {data.insights.map((insight, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                 <div className="flex items-center gap-2 mb-2">
                   {insight.type === 'risk' && <AlertTriangle size={14} className="text-rose-500" />}
                   {insight.type === 'bottleneck' && <Zap size={14} className="text-amber-500" />}
                   {insight.type === 'resource' && <Users size={14} className="text-blue-500" />}
                   <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{insight.type}</span>
                 </div>
                 <h4 className="text-sm font-semibold text-gray-900 mb-1 leading-tight">{insight.title}</h4>
                 <p className="text-xs text-gray-600 leading-relaxed">{insight.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};