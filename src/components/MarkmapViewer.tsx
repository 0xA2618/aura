import React, { useEffect, useRef } from 'react';
import { Transformer } from 'markmap-lib';
import { Markmap } from 'markmap-view';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MarkmapViewerProps {
  content: string;
  themeId?: string;
  className?: string;
}

const transformer = new Transformer();

export const MarkmapViewer: React.FC<MarkmapViewerProps> = ({
  content,
  themeId = 'vs-dark',
  className = 'w-full h-full',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const markmapRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    try {
      const { root } = transformer.transform(content || '# Untitled');
      if (!markmapRef.current) {
        markmapRef.current = Markmap.create(svgRef.current, {
          duration: 300,
          color: (node) => {
            const palette = [
              '#00ADD8',
              '#FA8C16',
              '#A855F7',
              '#52C41A',
              '#EB2F96',
              '#13C2C2',
              '#FADB14',
              '#1890FF',
            ];
            const depth = node.state?.depth || 0;
            return palette[depth % palette.length];
          },
        }, root);
      } else {
        markmapRef.current.setData(root);
        markmapRef.current.fit();
      }
    } catch (e) {
      console.error('[Markmap Render Error]', e);
    }
  }, [content, themeId]);

  const handleZoomIn = () => {
    try {
      markmapRef.current?.rescale(1.25);
    } catch (e) {}
  };

  const handleZoomOut = () => {
    try {
      markmapRef.current?.rescale(0.8);
    } catch (e) {}
  };

  const handleFit = () => {
    try {
      markmapRef.current?.fit();
    } catch (e) {}
  };

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${className}`}>
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing font-sans"
      />

      <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-[var(--aura-card-bg,#252526)] border border-[var(--aura-border,#333333)] rounded-lg p-1 shadow-xl z-20">
        <button
          onClick={handleZoomIn}
          title="Zoom In (放大)"
          className="p-1.5 hover:bg-black/10 dark:hover:bg-[#383838] text-[var(--aura-text)] rounded transition-colors"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out (缩小)"
          className="p-1.5 hover:bg-black/10 dark:hover:bg-[#383838] text-[var(--aura-text)] rounded transition-colors"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={handleFit}
          title="Fit View (自适应居中)"
          className="p-1.5 hover:bg-black/10 dark:hover:bg-[#383838] text-[var(--aura-text)] rounded transition-colors"
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
};
