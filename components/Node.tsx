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
      case NodeType.TRIGGER: return <Play size={16} />;
      case NodeType.AGENT: return <Bot size={16} />;
      case NodeType.TOOL: return <Wrench size={16} />;
      case NodeType.END: return <Flag size={16} />;
      default: return <MoreHorizontal size={16} />;
    }
  };

  const getStyles = () => {
    switch (data.type) {
      case NodeType.TRIGGER: return { header: 'bg-teal text-white', border: 'border-slate' };
      case NodeType.AGENT: return { header: 'bg-slate text-cream', border: 'border-slate' };
      case NodeType.TOOL: return { header: 'bg-terra text-white', border: 'border-slate' };
      case NodeType.END: return { header: 'bg-slate text-white', border: 'border-slate' };
      default: return { header: 'bg-gray-200 text-slate', border: 'border-slate' };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`absolute w-64 bg-white border-2 border-slate transition-all group
        ${isSelected ? 'shadow-[8px_8px_0px_0px_#CE6764] -translate-y-1' : 'shadow-hard hover:shadow-[6px_6px_0px_0px_#456365]'}
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
      <div className={`px-4 py-3 border-b-2 border-slate flex items-center gap-3 ${styles.header}`}>
        <div className="p-1 border border-current rounded-sm">
          {getIcon()}
        </div>
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wide leading-none mb-1">{data.label}</h3>
          <p className="text-[9px] opacity-80 uppercase tracking-widest">{data.type}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 bg-white">
        <p className="text-xs text-slate font-medium leading-relaxed line-clamp-3">
          {data.description || 'No description provided.'}
        </p>
        {data.type === NodeType.AGENT && (
          <div className="mt-3 text-[10px] text-teal font-bold border border-teal/30 bg-teal/5 px-2 py-1 inline-block">
            {data.config.model || 'default-model'}
          </div>
        )}
      </div>

      {/* Ports */}
      {data.type !== NodeType.TRIGGER && (
        <div className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-4 h-4 bg-cream border-2 border-slate rounded-full" />
      )}
      {data.type !== NodeType.END && (
        <div className="absolute -right-[9px] top-1/2 -translate-y-1/2 w-4 h-4 bg-teal border-2 border-slate rounded-full hover:scale-125 transition-transform" />
      )}
    </div>
  );
};