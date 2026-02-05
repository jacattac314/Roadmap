import React, { useState, useMemo, useRef } from 'react';
import { RoadmapData, PriorityLevel, RiskLevel, Status, AIInsight } from '../types';
import { Download, ZoomIn, ZoomOut, Filter, Layers, AlertTriangle, Activity, Users, Zap, Brain, ChevronRight, X, ListTodo } from 'lucide-react';

interface Props {
  data: RoadmapData;
}

// Color Maps
const PRIORITY_COLORS = {
  must_have: '#EF4444',   // Red
  should_have: '#F97316', // Orange
  could_have: '#EAB308',  // Yellow
  wont_have: '#22C55E'    // Green
};

const RISK_COLORS = {
  high: '#DC2626',   // Deep Red
  medium: '#F59E0B', // Amber
  low: '#10B981'     // Emerald
};

const STATUS_COLORS = {
  planned: '#94a3b8',    // Gray
  in_progress: '#3b82f6', // Blue
  completed: '#10b981',   // Green
  blocked: '#ef4444',     // Red
  at_risk: '#f59e0b'      // Amber
};

const TEAM_COLORS: Record<string, string> = {
  'Backend': '#3B82F6',
  'Frontend': '#EC4899',
  'Mobile': '#8B5CF6',
  'Design': '#F472B6',
  'Data': '#059669',
  'General': '#6B7280'
};

const LABELS: Record<PriorityLevel, string> = {
  must_have: 'Must Have',
  should_have: 'Should Have',
  could_have: 'Could Have',
  wont_have: "Won't Have"
};

type ViewMode = 'priority' | 'risk' | 'team' | 'status';

export const RoadmapVisualizer: React.FC<Props> = ({ data }) => {
  const [zoom, setZoom] = useState(1);
  const [showDeps, setShowDeps] = useState(true);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('priority');
  const [showInsights, setShowInsights] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);

  // Layout Constants
  const QUARTER_WIDTH = 300 * zoom;
  const ROW_HEIGHT = 60;
  const HEADER_HEIGHT = 80;
  const SIDEBAR_WIDTH = 280;
  const TOTAL_WIDTH = SIDEBAR_WIDTH + (QUARTER_WIDTH * 4);

  // Sort and Filter Data
  const sortedFeatures = useMemo(() => {
    return [...data.features].sort((a, b) => {
        // Sort by quarter start, then priority
        const qDiff = Math.min(...a.quarters) - Math.min(...b.quarters);
        if (qDiff !== 0) return qDiff;
        const pOrder = ['must_have', 'should_have', 'could_have', 'wont_have'];
        return pOrder.indexOf(a.priority) - pOrder.indexOf(b.priority);
    });
  }, [data.features]);

  const TOTAL_HEIGHT = HEADER_HEIGHT + (sortedFeatures.length * ROW_HEIGHT) + 50;

  // Helpers
  const getXForQuarter = (q: number) => SIDEBAR_WIDTH + ((q - 1) * QUARTER_WIDTH);

  const getFeatureColor = (feature: any) => {
    if (viewMode === 'risk') return RISK_COLORS[feature.risk as RiskLevel] || RISK_COLORS.low;
    if (viewMode === 'team') return TEAM_COLORS[feature.team] || TEAM_COLORS.General;
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
    link.download = `roadmap-${viewMode}-${new Date().toISOString().split('T')[0]}.svg`;
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
               <button 
                 onClick={() => setViewMode('team')}
                 className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${viewMode === 'team' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-900'}`}
               >
                 <Users size={14} /> Team
               </button>
            </div>

            <div className="h-6 w-px bg-gray-300" />

            {/* Toggles */}
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
          <div style={{ width: TOTAL_WIDTH, height: TOTAL_HEIGHT }} className="relative bg-white shadow-sm m-4">
            
            <svg 
              ref={svgRef}
              width={TOTAL_WIDTH} 
              height={TOTAL_HEIGHT} 
              xmlns="http://www.w3.org/2000/svg"
              className="block"
            >
              <defs>
                <pattern id="grid" width={QUARTER_WIDTH} height={ROW_HEIGHT} patternUnits="userSpaceOnUse">
                  <path d={`M ${QUARTER_WIDTH} 0 L ${QUARTER_WIDTH} ${ROW_HEIGHT} M 0 ${ROW_HEIGHT} L ${QUARTER_WIDTH} ${ROW_HEIGHT}`} fill="none" stroke="#e2e8f0" strokeWidth="1" />
                </pattern>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
                <marker id="arrowhead-critical" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
                </marker>
                {/* Stripe pattern for critical path */}
                <pattern id="diagonalHatch" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="10" style={{stroke:'rgba(255,255,255,0.3)', strokeWidth:2}} />
                </pattern>
                {/* Blocked pattern */}
                <pattern id="blockedStripe" width="8" height="8" patternTransform="rotate(135 0 0)" patternUnits="userSpaceOnUse">
                    <line x1="0" y1="0" x2="0" y2="8" style={{stroke:'#EF4444', strokeWidth:4}} />
                </pattern>
              </defs>

              {/* Background Grid */}
              <rect x={SIDEBAR_WIDTH} y={HEADER_HEIGHT} width={TOTAL_WIDTH - SIDEBAR_WIDTH} height={TOTAL_HEIGHT - HEADER_HEIGHT} fill="url(#grid)" />

              {/* Header Background */}
              <rect x="0" y="0" width={TOTAL_WIDTH} height={HEADER_HEIGHT} fill="#f8fafc" />
              <line x1="0" y1={HEADER_HEIGHT} x2={TOTAL_WIDTH} y2={HEADER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
              <line x1={SIDEBAR_WIDTH} y1="0" x2={SIDEBAR_WIDTH} y2={TOTAL_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />

              {/* Quarter Headers */}
              {[1, 2, 3, 4].map((q) => (
                <g key={q} transform={`translate(${getXForQuarter(q)}, 0)`}>
                  <text x={QUARTER_WIDTH / 2} y="30" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#334155">Q{q}</text>
                  <text x={QUARTER_WIDTH / 2} y="50" textAnchor="middle" fontSize="12" fill="#64748b">2024</text>
                  {/* Milestones */}
                  {data.milestones.filter(m => m.quarter === q).map((m, i) => (
                     <g key={i} transform={`translate(${QUARTER_WIDTH / 2}, ${HEADER_HEIGHT - 10})`}>
                       <polygon points="0,0 6,6 0,12 -6,6" fill="#8B5CF6" />
                       <text y="-8" textAnchor="middle" fontSize="10" fill="#7c3aed" fontWeight="bold">{m.name.substring(0, 15)}...</text>
                     </g>
                  ))}
                </g>
              ))}

              {/* Feature Rows */}
              {sortedFeatures.map((feature, idx) => {
                const y = HEADER_HEIGHT + (idx * ROW_HEIGHT);
                const centerY = y + (ROW_HEIGHT / 2);
                const startQ = Math.min(...feature.quarters);
                const endQ = Math.max(...feature.quarters);
                const xStart = getXForQuarter(startQ) + 20;
                const width = (endQ - startQ + 1) * QUARTER_WIDTH - 40;
                const barColor = getFeatureColor(feature);

                return (
                  <g key={feature.id} className="group">
                    {/* Sidebar Label */}
                    <g transform={`translate(20, ${centerY})`}>
                      <text y="-5" fontSize="13" fontWeight="600" fill="#1e293b">{feature.name.substring(0, 30)}{feature.name.length > 30 ? '...' : ''}</text>
                      
                      {/* Secondary Label based on View Mode */}
                      {viewMode === 'priority' && (
                        <text y="12" fontSize="10" fill="#64748b" className="uppercase">{LABELS[feature.priority]}</text>
                      )}
                      {viewMode === 'risk' && (
                         <text y="12" fontSize="10" fill={feature.risk === 'high' ? '#DC2626' : '#64748b'} className="uppercase font-bold">
                             {feature.risk} RISK
                         </text>
                      )}
                      {viewMode === 'team' && (
                        <text y="12" fontSize="10" fill="#64748b" className="uppercase">Team: {feature.team}</text>
                      )}
                      {viewMode === 'status' && (
                        <text y="12" fontSize="10" fill={STATUS_COLORS[feature.status]} className="uppercase font-medium">
                            {feature.status.replace('_', ' ')}
                        </text>
                      )}

                      <circle cx="-10" cy="-2" r="4" fill={barColor} />
                    </g>

                    {/* Feature Bar */}
                    <rect 
                      x={xStart} y={y + 15} width={width} height={ROW_HEIGHT - 30} rx="6" 
                      fill={barColor} 
                      opacity="0.9"
                      stroke={showCriticalPath && feature.isCriticalPath ? '#EF4444' : 'none'}
                      strokeWidth={showCriticalPath && feature.isCriticalPath ? 2 : 0}
                    />
                    
                    {/* Critical Path Hatching */}
                    {showCriticalPath && feature.isCriticalPath && (
                        <rect x={xStart} y={y + 15} width={width} height={ROW_HEIGHT - 30} rx="6" fill="url(#diagonalHatch)" />
                    )}
                    
                    {/* Confidence Indicator (small dot) */}
                    <circle cx={xStart + width - 10} cy={centerY} r="3" fill="white" fillOpacity="0.5" />
                    <text x={xStart + width - 20} y={centerY + 3} textAnchor="end" fontSize="9" fill="white" opacity="0.8">{feature.confidence}%</text>

                    {/* Dependencies Lines */}
                    {showDeps && feature.dependencies?.map(depName => {
                      const parent = sortedFeatures.find(f => f.name.toLowerCase().includes(depName.toLowerCase()) || depName.toLowerCase().includes(f.name.toLowerCase()));
                      if (!parent) return null;
                      
                      const parentIdx = sortedFeatures.indexOf(parent);
                      const parentY = HEADER_HEIGHT + (parentIdx * ROW_HEIGHT) + (ROW_HEIGHT/2);
                      const parentEndQ = Math.max(...parent.quarters);
                      const parentX = getXForQuarter(parentEndQ) + ((parentEndQ - Math.min(...parent.quarters) + 1) * QUARTER_WIDTH) - 20;

                      // Is this edge part of critical path?
                      const isCritEdge = showCriticalPath && feature.isCriticalPath && parent.isCriticalPath;

                      // Draw curve
                      const path = `M ${parentX} ${parentY} C ${parentX + 50} ${parentY}, ${xStart - 50} ${centerY}, ${xStart} ${centerY}`;
                      
                      return (
                        <path 
                          key={`${parent.id}-${feature.id}`}
                          d={path}
                          fill="none"
                          stroke={isCritEdge ? '#EF4444' : '#94a3b8'}
                          strokeWidth={isCritEdge ? 2 : 1.5}
                          strokeDasharray={isCritEdge ? '0' : '4 2'}
                          markerEnd={isCritEdge ? "url(#arrowhead-critical)" : "url(#arrowhead)"}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
        
        {/* Legend */}
        <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-6 text-xs overflow-x-auto">
           {viewMode === 'priority' && (
             <>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#EF4444]"></div><span>Must Have</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#F97316]"></div><span>Should Have</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#EAB308]"></div><span>Could Have</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#22C55E]"></div><span>Won't Have</span></div>
             </>
           )}
           {viewMode === 'status' && (
             <>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#94a3b8]"></div><span>Planned</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#3b82f6]"></div><span>In Progress</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10b981]"></div><span>Completed</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#ef4444]"></div><span>Blocked</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div><span>At Risk</span></div>
             </>
           )}
           {viewMode === 'risk' && (
             <>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#DC2626]"></div><span>High Risk</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#F59E0B]"></div><span>Medium Risk</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10B981]"></div><span>Low Risk</span></div>
             </>
           )}
           {viewMode === 'team' && Object.keys(TEAM_COLORS).map(team => (
             <div key={team} className="flex items-center gap-2">
               <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TEAM_COLORS[team] }}></div>
               <span>{team}</span>
             </div>
           ))}
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
                 {insight.severity === 'high' && (
                   <div className="mt-2 text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded inline-block font-medium">High Severity</div>
                 )}
              </div>
            ))}
            
            {data.insights.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">
                No major risks or insights detected.
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};