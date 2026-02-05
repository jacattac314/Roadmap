import React, { useState, useMemo, useRef } from 'react';
import { RoadmapData, RoadmapFeature, PriorityLevel } from '../types';
import { Download, ZoomIn, ZoomOut, Filter, ChevronDown, ChevronRight, Layers } from 'lucide-react';

interface Props {
  data: RoadmapData;
}

const COLORS = {
  must_have: '#EF4444',   // Red
  should_have: '#F97316', // Orange
  could_have: '#EAB308',  // Yellow
  wont_have: '#22C55E',   // Green
  dependency: '#94a3b8',
  grid: '#e2e8f0',
  text: '#1e293b'
};

const LABELS: Record<PriorityLevel, string> = {
  must_have: 'Must Have',
  should_have: 'Should Have',
  could_have: 'Could Have',
  wont_have: "Won't Have"
};

export const RoadmapVisualizer: React.FC<Props> = ({ data }) => {
  const [zoom, setZoom] = useState(1);
  const [showDeps, setShowDeps] = useState(true);
  const [filterPriority, setFilterPriority] = useState<PriorityLevel | 'all'>('all');
  const svgRef = useRef<SVGSVGElement>(null);

  // Layout Constants
  const QUARTER_WIDTH = 300 * zoom;
  const ROW_HEIGHT = 60;
  const HEADER_HEIGHT = 80;
  const SIDEBAR_WIDTH = 280;
  const TOTAL_WIDTH = SIDEBAR_WIDTH + (QUARTER_WIDTH * 4);

  // Filter Data
  const filteredFeatures = useMemo(() => {
    return data.features.filter(f => 
      filterPriority === 'all' || f.priority === filterPriority
    ).sort((a, b) => {
        // Sort by quarter start, then priority
        const qDiff = Math.min(...a.quarters) - Math.min(...b.quarters);
        if (qDiff !== 0) return qDiff;
        const pOrder = ['must_have', 'should_have', 'could_have', 'wont_have'];
        return pOrder.indexOf(a.priority) - pOrder.indexOf(b.priority);
    });
  }, [data.features, filterPriority]);

  const TOTAL_HEIGHT = HEADER_HEIGHT + (filteredFeatures.length * ROW_HEIGHT) + 50;

  // Helper to get X coordinate for a quarter
  const getXForQuarter = (q: number) => SIDEBAR_WIDTH + ((q - 1) * QUARTER_WIDTH);

  // Download SVG Logic
  const handleDownload = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `roadmap-${new Date().toISOString().split('T')[0]}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Toolbar */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white rounded-md border border-gray-200 p-1">
            <button 
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button 
              onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select 
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as any)}
              className="text-sm border-none bg-transparent focus:ring-0 text-gray-700 font-medium cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
            >
              <option value="all">All Priorities</option>
              <option value="must_have">Must Have</option>
              <option value="should_have">Should Have</option>
              <option value="could_have">Could Have</option>
            </select>
          </div>

          <button 
            onClick={() => setShowDeps(!showDeps)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${showDeps ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Layers size={14} />
            Dependencies
          </button>
        </div>

        <button 
          onClick={handleDownload}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs font-medium hover:bg-gray-800 transition-colors shadow-sm"
        >
          <Download size={14} />
          Export SVG
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
                <path d={`M ${QUARTER_WIDTH} 0 L ${QUARTER_WIDTH} ${ROW_HEIGHT} M 0 ${ROW_HEIGHT} L ${QUARTER_WIDTH} ${ROW_HEIGHT}`} fill="none" stroke={COLORS.grid} strokeWidth="1" />
              </pattern>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill={COLORS.dependency} />
              </marker>
              {/* Gradients */}
              <linearGradient id="grad-must" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{stopColor: COLORS.must_have, stopOpacity: 0.9}} />
                <stop offset="100%" style={{stopColor: COLORS.must_have, stopOpacity: 0.7}} />
              </linearGradient>
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
                {/* Milestones for this quarter */}
                {data.milestones.filter(m => m.quarter === q).map((m, i) => (
                   <g key={i} transform={`translate(${QUARTER_WIDTH / 2}, ${HEADER_HEIGHT - 10})`}>
                     <polygon points="0,0 6,6 0,12 -6,6" fill="#8B5CF6" />
                     <text y="-8" textAnchor="middle" fontSize="10" fill="#7c3aed" fontWeight="bold">{m.name.substring(0, 15)}...</text>
                   </g>
                ))}
              </g>
            ))}

            {/* Feature Rows */}
            {filteredFeatures.map((feature, idx) => {
              const y = HEADER_HEIGHT + (idx * ROW_HEIGHT);
              const centerY = y + (ROW_HEIGHT / 2);
              
              const startQ = Math.min(...feature.quarters);
              const endQ = Math.max(...feature.quarters);
              
              const xStart = getXForQuarter(startQ) + 20; // Padding
              const width = (endQ - startQ + 1) * QUARTER_WIDTH - 40; // Padding

              return (
                <g key={feature.id} className="group">
                  {/* Sidebar Label */}
                  <g transform={`translate(20, ${centerY})`}>
                    <text y="-5" fontSize="13" fontWeight="600" fill="#1e293b">{feature.name.substring(0, 35)}{feature.name.length > 35 ? '...' : ''}</text>
                    <text y="12" fontSize="10" fill="#64748b" className="uppercase tracking-wider">{LABELS[feature.priority]}</text>
                    
                    {/* Priority Indicator Dot */}
                    <circle cx="-10" cy="-2" r="4" fill={COLORS[feature.priority]} />
                  </g>

                  {/* Feature Bar */}
                  <rect 
                    x={xStart} 
                    y={y + 15} 
                    width={width} 
                    height={ROW_HEIGHT - 30} 
                    rx="6" 
                    fill={COLORS[feature.priority]} 
                    opacity="0.9"
                    className="transition-all hover:opacity-100 cursor-pointer"
                  />
                  
                  {/* Dependencies Lines */}
                  {showDeps && feature.dependencies?.map(depName => {
                    const parent = filteredFeatures.find(f => f.name.toLowerCase().includes(depName.toLowerCase()) || depName.toLowerCase().includes(f.name.toLowerCase()));
                    if (!parent) return null;
                    
                    const parentIdx = filteredFeatures.indexOf(parent);
                    const parentY = HEADER_HEIGHT + (parentIdx * ROW_HEIGHT) + (ROW_HEIGHT/2);
                    const parentEndQ = Math.max(...parent.quarters);
                    const parentX = getXForQuarter(parentEndQ) + ((parentEndQ - Math.min(...parent.quarters) + 1) * QUARTER_WIDTH) - 20;

                    // Draw curve
                    const path = `M ${parentX} ${parentY} C ${parentX + 50} ${parentY}, ${xStart - 50} ${centerY}, ${xStart} ${centerY}`;
                    
                    return (
                      <path 
                        key={`${parent.id}-${feature.id}`}
                        d={path}
                        fill="none"
                        stroke={COLORS.dependency}
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                        markerEnd="url(#arrowhead)"
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
      <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center gap-6 text-xs">
         <span className="font-semibold text-gray-500 uppercase">Legend:</span>
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-[#EF4444]"></div>
           <span>Must Have</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-[#F97316]"></div>
           <span>Should Have</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-[#EAB308]"></div>
           <span>Could Have</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 rounded-full bg-[#22C55E]"></div>
           <span>Won't Have</span>
         </div>
         <div className="flex items-center gap-2">
           <div className="w-3 h-3 rotate-45 border border-purple-500 bg-purple-100"></div>
           <span>Milestone</span>
         </div>
      </div>
    </div>
  );
};