/**
 * ============================================================
 * @module shared/components
 * @file VisualAnalysis.tsx
 * ============================================================
 * @description 시각적 분석 컴포넌트 - 인물 관계도 및 사건 타임라인
 * ============================================================
 */

import React, { useMemo, useState, useEffect } from 'react';
import type { VisualAnalysisData } from '@core/types';
import { UserGroupIcon, ClockIcon } from './Icons';

interface VisualAnalysisProps {
  data: VisualAnalysisData;
}

export function VisualAnalysis({ data }: VisualAnalysisProps) {
  const { relationshipGraph, eventTimeline } = data;
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setContainerSize({ width, height: Math.max(height, 300) });
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    if (containerSize.width === 0 || containerSize.height === 0) return positions;

    const radius = Math.min(containerSize.width, containerSize.height) / 2 - 40;
    const centerX = containerSize.width / 2;
    const centerY = containerSize.height / 2;

    relationshipGraph.nodes.forEach((node, index) => {
      const angle = (index / relationshipGraph.nodes.length) * 2 * Math.PI;
      positions.set(node.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });
    return positions;
  }, [relationshipGraph.nodes, containerSize]);

  return (
    <div className="space-y-8">
      {/* Relationship Graph */}
      <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold mb-4 text-indigo-400 text-lg flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5" />
          시각적 인물 관계도
        </h3>
        <div ref={containerRef} className="relative w-full h-96 min-h-[300px]">
          {containerSize.width > 0 && (
            <svg
              className="absolute top-0 left-0 w-full h-full"
              style={{ zIndex: 1 }}
            >
              {relationshipGraph.links.map((link, index) => {
                const sourcePos = nodePositions.get(link.source);
                const targetPos = nodePositions.get(link.target);
                if (!sourcePos || !targetPos) return null;

                const midX = (sourcePos.x + targetPos.x) / 2;
                const midY = (sourcePos.y + targetPos.y) / 2;
                const angle =
                  (Math.atan2(
                    targetPos.y - sourcePos.y,
                    targetPos.x - sourcePos.x
                  ) *
                    180) /
                  Math.PI;

                return (
                  <g key={index}>
                    <line
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      className="stroke-gray-500"
                      strokeWidth="1"
                    />
                    <text
                      x={midX}
                      y={midY}
                      fill="#a5b4fc"
                      fontSize="10"
                      textAnchor="middle"
                      transform={`rotate(${angle}, ${midX}, ${midY})`}
                      dy="-4"
                    >
                      {link.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}

          {relationshipGraph.nodes.map((node) => {
            const pos = nodePositions.get(node.id);
            if (!pos) return null;
            return (
              <div
                key={node.id}
                className="absolute px-3 py-1 bg-gray-800 border border-indigo-500 rounded-full text-white text-sm shadow-lg transition-transform duration-300"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 2,
                }}
              >
                {node.name}
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Timeline */}
      <div className="bg-gray-700 p-4 rounded-lg">
        <h3 className="font-semibold mb-4 text-indigo-400 text-lg flex items-center gap-2">
          <ClockIcon className="w-5 h-5" />
          시각적 사건 타임라인
        </h3>
        <div className="relative border-l-2 border-gray-600 ml-4 pl-6 space-y-6">
          {eventTimeline.map((event, index) => (
            <div key={index} className="relative">
              <div className="absolute -left-[34px] top-1 w-4 h-4 bg-indigo-500 rounded-full border-4 border-gray-700"></div>
              <h4 className="font-bold text-gray-200">{event.title}</h4>
              <p className="text-sm text-gray-400">{event.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
