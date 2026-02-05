import React, { useState, useRef, useCallback } from 'react';
import { NodeData, Edge, NodeType } from '../types';
import { Node } from './Node';

interface CanvasProps {
  nodes: NodeData[];
  edges: Edge[];
  selectedNodeId: string | null;
  onNodeSelect: (id: string | null) => void;
  onNodesChange: (nodes: NodeData[]) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onNodeSelect,
  onNodesChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Simple Bezier curve calculation for edges
  const getPath = (sourceId: string, targetId: string) => {
    const sourceNode = nodes.find(n => n.id === sourceId);
    const targetNode = nodes.find(n => n.id === targetId);

    if (!sourceNode || !targetNode) return '';

    const sx = sourceNode.x + 128; // Right edge (width/2)
    const sy = sourceNode.y;
    const tx = targetNode.x - 128; // Left edge (width/2)
    const ty = targetNode.y;

    // Cubic Bezier Control Points
    const c1x = sx + 100;
    const c1y = sy;
    const c2x = tx - 100;
    const c2y = ty;

    return `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`;
  };

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent canvas click
    setIsDragging(true);
    setDraggedNodeId(id);
    onNodeSelect(id);
  }, [onNodeSelect]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !draggedNodeId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    onNodesChange(nodes.map(node => {
      if (node.id === draggedNodeId) {
        return { ...node, x, y };
      }
      return node;
    }));
  }, [isDragging, draggedNodeId, nodes, onNodesChange]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNodeId(null);
  }, []);

  const handleCanvasClick = () => {
    onNodeSelect(null);
  };

  return (
    <div
      ref={canvasRef}
      className="w-full h-full bg-gray-50 pattern-grid overflow-hidden relative select-none"
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onClick={handleCanvasClick}
    >
      {/* SVG Layer for Connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
          </marker>
        </defs>
        {edges.map(edge => (
          <path
            key={edge.id}
            d={getPath(edge.source, edge.target)}
            stroke="#94a3b8"
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        ))}
      </svg>

      {/* Nodes Layer */}
      <div className="z-10 relative w-full h-full">
        {nodes.map(node => (
          <Node
            key={node.id}
            data={node}
            isSelected={selectedNodeId === node.id}
            onMouseDown={handleMouseDown}
            onClick={onNodeSelect}
          />
        ))}
      </div>

      {/* Instructions Overlay */}
      <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur p-3 rounded-lg shadow-sm border border-gray-200 text-xs text-gray-500 pointer-events-none">
        Drag nodes to rearrange. Click a node to configure.
      </div>
    </div>
  );
};
