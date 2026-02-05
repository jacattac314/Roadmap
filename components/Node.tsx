import React from 'react';
import { NodeData, NodeType } from '../types';
import { Play, Bot, Wrench, Flag, MoreHorizontal } from 'lucide-react';

interface NodeProps {
  data: NodeData;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onClick: (id: string) => void;
}

export const Node: React.FC<NodeProps> = ({ data, isSelected, onMouseDown, onClick }) => {
  const getIcon = () => {
    switch (data.type) {
      case NodeType.TRIGGER: return <Play size={16} className="text-emerald-600" />;
      case NodeType.AGENT: return <Bot size={16} className="text-blue-600" />;
      case NodeType.TOOL: return <Wrench size={16} className="text-amber-600" />;
      case NodeType.END: return <Flag size={16} className="text-rose-600" />;
      default: return <MoreHorizontal size={16} />;
    }
  };

  const getColor = () => {
    switch (data.type) {
      case NodeType.TRIGGER: return 'border-emerald-200 bg-emerald-50';
      case NodeType.AGENT: return 'border-blue-200 bg-blue-50';
      case NodeType.TOOL: return 'border-amber-200 bg-amber-50';
      case NodeType.END: return 'border-rose-200 bg-rose-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  return (
    <div
      className={`absolute w-64 rounded-lg border-2 shadow-sm transition-shadow group
        ${getColor()}
        ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500 shadow-md' : 'hover:shadow-md'}
        cursor-grab active:cursor-grabbing
      `}
      style={{
        left: data.x,
        top: data.y,
        transform: 'translate(-50%, -50%)' // Center anchor
      }}
      onMouseDown={(e) => onMouseDown(e, data.id)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(data.id);
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-black/5 flex items-center gap-3">
        <div className="p-1.5 bg-white rounded-md shadow-sm">
          {getIcon()}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{data.label}</h3>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">{data.type}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 bg-white/50 rounded-b-lg">
        <p className="text-xs text-gray-600 line-clamp-2">
          {data.description || 'No description provided.'}
        </p>
        {data.type === NodeType.AGENT && (
          <div className="mt-2 text-[10px] text-blue-600 font-mono bg-blue-100/50 px-2 py-1 rounded">
            {data.config.model || 'default-model'}
          </div>
        )}
      </div>

      {/* Ports */}
      {data.type !== NodeType.TRIGGER && (
        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-gray-400 rounded-full" />
      )}
      {data.type !== NodeType.END && (
        <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-gray-400 rounded-full" />
      )}
    </div>
  );
};
