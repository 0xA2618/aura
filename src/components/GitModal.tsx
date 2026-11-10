import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import {
  X,
  GitBranch,
  GitCommit as GitCommitIcon,
  Check,
  RotateCw,
  FileDiff,
  Calendar,
  User,
  Tag,
  ArrowUpCircle,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { GitCommit, FileItem } from '../types';
import {
  fetchCommitChangedFiles,
  fetchGitStatus,
  fetchGitCommits,
  executeGitCommit,
  executeGitPush,
} from '../services/fileService';
import { FileIcon } from './FileIcon';

interface GitModalProps {
  isOpen: boolean;
  workspaceDir: string;
  gitBranch?: string;
  commits: GitCommit[];
  files: FileItem[];
  onClose: () => void;
  onOpenDiff?: (commitHash: string, filePath: string) => void;
  onSelectFile?: (file: FileItem) => void;
}

const LANE_COLORS = [
  '#0284c7', // Sky Blue
  '#ea580c', // Bright Orange
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#eab308', // Amber
];

interface ComputedGraphNode {
  commit: GitCommit;
  lane: number;
  color: string;
  hasIncoming: boolean;
  hasOutgoing: boolean;
  badges: Array<{ type: 'branch' | 'tag' | 'head'; text: string }>;
  passThroughLanes: number[];
  parentLanes: number[];
}

function computeGitGraph(commits: GitCommit[]): ComputedGraphNode[] {
  const activeLanes: (string | null)[] = [];

  return commits.map((commit) => {
    let lane = activeLanes.indexOf(commit.hash);
    const hasIncoming = lane !== -1;
    if (lane === -1) {
      const emptySlot = activeLanes.indexOf(null);
      if (emptySlot !== -1) {
        lane = emptySlot;
      } else {
        lane = activeLanes.length;
      }
    }

    const color = LANE_COLORS[lane % LANE_COLORS.length];

    const passThroughLanes: number[] = [];
    activeLanes.forEach((targetHash, lIdx) => {
      if (targetHash && lIdx !== lane) {
        passThroughLanes.push(lIdx);
      }
    });

    const badges: Array<{ type: 'branch' | 'tag' | 'head'; text: string }> = [];
    if (commit.refs) {
      const raw = commit.refs.replace(/[()]/g, '').trim();
      if (raw) {
        raw.split(',').forEach((part) => {
          const item = part.trim();
          if (item.startsWith('tag:')) {
            badges.push({ type: 'tag', text: item.replace(/^tag:\s*/, '') });
          } else if (item.startsWith('HEAD ->')) {
            badges.push({ type: 'head', text: item.replace(/^HEAD ->\s*/, '') });
          } else if (item) {
            badges.push({ type: 'branch', text: item });
          }
        });
      }
    }

    const parents = commit.parents || [];
    const parentLanes: number[] = [];
    const hasOutgoing = parents.length > 0;

    if (parents.length === 0) {
      activeLanes[lane] = null;
    } else {
      activeLanes[lane] = parents[0];
      parentLanes.push(lane);

      for (let p = 1; p < parents.length; p++) {
        const pHash = parents[p];
        let pLane = activeLanes.indexOf(pHash);
        if (pLane === -1) {
          const emptySlot = activeLanes.indexOf(null);
          if (emptySlot !== -1) {
            pLane = emptySlot;
          } else {
            pLane = activeLanes.length;
          }
          activeLanes[pLane] = pHash;
        }
        parentLanes.push(pLane);
      }
    }

    while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
      activeLanes.pop();
    }

    return {
      commit,
      lane,
      color,
      hasIncoming,
      hasOutgoing,
      badges,
      passThroughLanes,
      parentLanes,
    };
  });
}

interface GitCommitRowProps {
  node: ComputedGraphNode;
  isSelected: boolean;
  changedInCommit: { path: string; status: string }[];
  railBaseX: number;
  laneW: number;
  onToggleSelect: () => void;
  onClose: () => void;
  onOpenDiff?: (commitHash: string, filePath: string) => void;
}

const GitCommitRow: React.FC<GitCommitRowProps> = ({
  node,
  isSelected,
  changedInCommit,
  railBaseX,
  laneW,
  onToggleSelect,
  onClose,
  onOpenDiff,
}) => {
  const commit = node.commit;
  const isMultiLine = node.badges.length >= 2;
  const baseRowH = isMultiLine ? 54 : 40;
  const nodeY = isMultiLine ? 27 : 20;

  const rowRef = useRef<HTMLDivElement>(null);
  const [actualHeight, setActualHeight] = useState<number>(baseRowH);

  useLayoutEffect(() => {
    if (!rowRef.current) return;
    const update = () => {
      if (rowRef.current) {
        const h = rowRef.current.offsetHeight;
        if (h > 0) setActualHeight(h);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, [isSelected, changedInCommit.length, isMultiLine]);

  // Dynamic column width: branch lines and commit description self-adapt
  const lanesInRow = [node.lane, ...node.passThroughLanes, ...node.parentLanes];
  const maxLaneInRow = Math.max(...lanesInRow, 0);
  const rightmostRailX = railBaseX + maxLaneInRow * laneW;
  const graphWidth = rightmostRailX + 20;
  const nodeX = railBaseX + node.lane * laneW;

  const curveOffset = isMultiLine ? 22 : 18;
  const curveC1 = isMultiLine ? 14 : 12;
  const curveC2 = isMultiLine ? 8 : 6;

  const badgeRightX = railBaseX - 22;

  return (
    <div
      ref={rowRef}
      style={{ minHeight: `${baseRowH}px` }}
      className={`flex items-stretch border-b border-[var(--aura-border)]/20 relative group ${
        isSelected ? 'bg-[var(--aura-accent,#007acc)]/5' : 'hover:bg-black/5 dark:hover:bg-white/[0.04]'
      }`}
    >
      {/* Graph Column: extends all the way down through the row (even when expanded!) */}
      <div
        style={{ width: `${graphWidth}px` }}
        className="relative flex-shrink-0 self-stretch overflow-visible select-none"
      >
        {/* Badges on left */}
        {node.badges.length > 0 && (
          <div
            style={{ height: `${baseRowH}px`, width: `${railBaseX - 26}px` }}
            className="absolute left-2.5 top-0 flex flex-col justify-center items-start gap-1 overflow-hidden z-10 pointer-events-none"
          >
            {node.badges.slice(0, 2).map((b, bIdx) => (
              <span
                key={bIdx}
                className={`inline-flex items-center gap-1 text-[9.5px] font-mono px-1.5 py-0.5 rounded-full border select-none shadow-xs shrink-0 max-w-[124px] pointer-events-auto leading-tight ${
                  b.type === 'tag'
                    ? 'border-amber-500/50 text-amber-400 bg-amber-500/10'
                    : 'border-sky-500/50 text-sky-400 bg-sky-500/10'
                }`}
                title={b.text}
              >
                {b.type === 'tag' ? <Tag size={8.5} className="shrink-0" /> : <GitBranch size={8.5} className="shrink-0" />}
                <span className="truncate max-w-[96px]">{b.text}</span>
              </span>
            ))}
            {node.badges.length > 2 && (
              <span
                className="inline-flex items-center text-[9px] font-mono px-1 py-0.2 rounded-full border border-[var(--aura-border)] text-[var(--aura-text-muted)] bg-black/10 dark:bg-white/5 shrink-0 pointer-events-auto"
                title={node.badges.slice(2).map((b) => b.text).join(', ')}
              >
                +{node.badges.length - 2}
              </span>
            )}
          </div>
        )}

        {/* SVG Track & Lines - Extending seamlessly through actualHeight + 1 without ANY gaps */}
        <svg
          width={graphWidth}
          height={actualHeight}
          style={{ width: `${graphWidth}px`, height: `${actualHeight}px` }}
          className="absolute left-0 top-0 pointer-events-none overflow-visible block"
        >
          {/* Connector from badge to node */}
          {node.badges.length > 0 && (
            <line
              x1={badgeRightX}
              y1={nodeY}
              x2={nodeX}
              y2={nodeY}
              stroke={node.color}
              strokeWidth={1.5}
              strokeDasharray="3 2"
              strokeOpacity={0.7}
            />
          )}

          {/* Pass-through lanes (top -1 to bottom actualHeight + 1) */}
          {node.passThroughLanes.map((lIdx) => {
            const px = railBaseX + lIdx * laneW;
            return (
              <line
                key={lIdx}
                x1={px}
                y1={-1}
                x2={px}
                y2={actualHeight + 1}
                stroke={LANE_COLORS[lIdx % LANE_COLORS.length]}
                strokeWidth={2.5}
              />
            );
          })}

          {/* Incoming line from top to node */}
          {node.hasIncoming && (
            <line
              x1={nodeX}
              y1={-1}
              x2={nodeX}
              y2={nodeY}
              stroke={node.color}
              strokeWidth={2.5}
            />
          )}

          {/* Outgoing line(s) to parents (from nodeY to bottom actualHeight + 1) */}
          {node.parentLanes.map((pLane, pIdx) => {
            const px = railBaseX + pLane * laneW;
            if (pLane === node.lane) {
              return (
                <line
                  key={pIdx}
                  x1={nodeX}
                  y1={nodeY}
                  x2={nodeX}
                  y2={actualHeight + 1}
                  stroke={node.color}
                  strokeWidth={2.5}
                />
              );
            }
            return (
              <g key={pIdx}>
                <path
                  d={`M ${nodeX},${nodeY} C ${nodeX},${nodeY + curveC1} ${px},${nodeY + curveC2} ${px},${nodeY + curveOffset}`}
                  fill="none"
                  stroke={LANE_COLORS[pLane % LANE_COLORS.length]}
                  strokeWidth={2.5}
                />
                <line
                  x1={px}
                  y1={nodeY + curveOffset}
                  x2={px}
                  y2={actualHeight + 1}
                  stroke={LANE_COLORS[pLane % LANE_COLORS.length]}
                  strokeWidth={2.5}
                />
              </g>
            );
          })}

          {/* Commit node circle */}
          <circle
            cx={nodeX}
            cy={nodeY}
            r={4.5}
            fill="var(--aura-card-bg, #252526)"
            stroke={node.color}
            strokeWidth={2.5}
          />
        </svg>
      </div>

      {/* Description column: shifts right when branches increase, shifts left when branches decrease */}
      <div className="flex-1 min-w-0 flex flex-col justify-center pr-4 py-1.5">
        {/* Commit row header */}
        <div
          onClick={onToggleSelect}
          style={{ minHeight: `${baseRowH - 8}px` }}
          className="flex items-center justify-between gap-2 cursor-pointer"
        >
          <div className="min-w-0 flex-1">
            <span
              className="font-medium text-xs text-[var(--aura-text)] truncate block group-hover:text-[var(--aura-accent,#007acc)] transition-colors leading-tight"
              title={commit.message}
            >
              {commit.message}
            </span>
            <div className="flex items-center gap-2 text-[10px] text-[var(--aura-text-muted)] mt-0.5 leading-none">
              <span className="truncate">{commit.author}</span>
              <span>•</span>
              <span className="flex-shrink-0">{commit.date}</span>
            </div>
          </div>
          <span className="font-mono text-[10px] text-[var(--aura-text-muted)] flex-shrink-0 px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/5">
            {commit.hash.slice(0, 7)}
          </span>
        </div>

        {/* Expanded files in this commit: strictly on the RIGHT of the line */}
        {isSelected && (
          <div className="mt-2.5 pt-2 border-t border-[var(--aura-border)]/30 space-y-1 pb-1">
            <div className="text-[10px] uppercase font-bold text-[var(--aura-text-muted)] tracking-wider">
              Files Changed in Commit ({changedInCommit.length})
            </div>
            {changedInCommit.length === 0 ? (
              <div className="text-[11px] text-[var(--aura-text-muted)] italic">
                Loading files or no files recorded...
              </div>
            ) : (
              changedInCommit.map((f) => (
                <div
                  key={f.path}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    onOpenDiff?.(commit.hash, f.path);
                  }}
                  className="flex items-center justify-between py-1 px-2.5 rounded hover:bg-[var(--aura-accent,#007acc)]/15 text-[var(--aura-text)] text-xs transition-colors cursor-pointer bg-black/10 dark:bg-white/[0.03]"
                >
                  <span className="font-mono text-xs truncate flex-1">{f.path}</span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                      f.status === 'M'
                        ? 'text-amber-400 bg-amber-400/15'
                        : f.status === 'A'
                        ? 'text-emerald-400 bg-emerald-400/15'
                        : 'text-rose-400 bg-rose-400/15'
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const GitModal: React.FC<GitModalProps> = ({
  isOpen,
  workspaceDir,
  gitBranch,
  commits: initialCommits = [],
  files = [],
  onClose,
  onOpenDiff,
  onSelectFile,
}) => {
  const [activeTab, setActiveTab] = useState<'changes' | 'history'>('changes');
  const [commits, setCommits] = useState<GitCommit[]>(initialCommits);
  const [gitStatusData, setGitStatusData] = useState<{ totalChanged: number; files: FileItem[] }>({
    totalChanged: 0,
    files: [],
  });
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitFilesMap, setCommitFilesMap] = useState<Record<string, { path: string; status: string }[]>>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Commit & Push states
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal dragging state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // Prevent drag when clicking interactive elements (buttons, inputs)
    if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: position.x,
      startY: position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: dragStartRef.current.startX + dx,
        y: dragStartRef.current.startY + dy,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    setCommits(initialCommits);
  }, [initialCommits]);

  const refreshStatus = async () => {
    if (!workspaceDir) return;
    setIsLoadingStatus(true);
    try {
      const [status, fetchedCommits] = await Promise.all([
        fetchGitStatus(workspaceDir),
        fetchGitCommits(workspaceDir),
      ]);
      setGitStatusData(status);
      if (fetchedCommits && fetchedCommits.length > 0) {
        setCommits(fetchedCommits);
      }
    } catch (err) {
      console.error('Failed to refresh git:', err);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshStatus();
      setFeedback(null);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, workspaceDir]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!selectedCommitHash || commitFilesMap[selectedCommitHash]) return;
    fetchCommitChangedFiles(selectedCommitHash, workspaceDir).then((changed) => {
      setCommitFilesMap((prev) => ({ ...prev, [selectedCommitHash]: changed }));
    });
  }, [selectedCommitHash, workspaceDir]);

  const handleCommit = async () => {
    const trimmed = commitMessage.trim();
    if (!trimmed) {
      setFeedback({ type: 'error', message: 'Please enter a commit message.' });
      return;
    }

    setIsCommitting(true);
    setFeedback(null);
    try {
      const result = await executeGitCommit(trimmed, workspaceDir);
      setCommitMessage('');
      setFeedback({ type: 'success', message: 'Changes committed successfully.' });
      await refreshStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: String(err) });
    } finally {
      setIsCommitting(false);
    }
  };

  const handlePush = async () => {
    setIsPushing(true);
    setFeedback(null);
    try {
      const result = await executeGitPush(workspaceDir);
      setFeedback({ type: 'success', message: 'Pushed to remote repository.' });
      await refreshStatus();
    } catch (err: any) {
      setFeedback({ type: 'error', message: String(err) });
    } finally {
      setIsPushing(false);
    }
  };

  const graphNodes = useMemo(() => computeGitGraph(commits), [commits]);

  const hasAnyBadges = useMemo(() => {
    return graphNodes.some((n) => n.badges.length > 0);
  }, [graphNodes]);

  const RAIL_BASE_X = hasAnyBadges ? 160 : 24;
  const LANE_W = 16;
  const headerGraphWidth = hasAnyBadges ? 190 : 60;

  if (!isOpen) return null;

  const changedFiles = gitStatusData.files.length > 0
    ? gitStatusData.files
    : files.filter((f) => f.gitStatus && f.gitStatus !== 'IGNORED');
  const changedCount = gitStatusData.totalChanged > 0 ? gitStatusData.totalChanged : changedFiles.length;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans select-none animate-in fade-in duration-100"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--aura-card-bg, #252526)',
          borderColor: 'var(--aura-border, #454545)',
          color: 'var(--aura-text, #cccccc)',
          transform: `translate(${position.x}px, ${position.y}px)`,
        }}
        className="w-[780px] max-w-[95vw] border rounded-xl shadow-2xl overflow-hidden flex flex-col duration-75"
      >
        {/* Header - Draggable */}
        <div
          onMouseDown={handleHeaderMouseDown}
          title="按住鼠标拖动窗口 (Drag to move)"
          style={{
            backgroundColor: 'var(--aura-topbar-bg, #1f1f1f)',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="flex items-center justify-between px-5 py-3 border-b select-none cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[var(--aura-accent,#007acc)]/15 text-[var(--aura-accent,#007acc)]">
              <GitBranch size={16} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[var(--aura-text)]">Source Control</span>
              {gitBranch && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium text-[var(--aura-text-muted)] bg-black/15 dark:bg-white/10 border border-[var(--aura-border)]/40 flex items-center gap-1">
                  <GitBranch size={10} className="text-[var(--aura-accent,#007acc)]" />
                  <span>{gitBranch}</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={refreshStatus}
              title="Refresh Git status"
              className="p-1.5 rounded-lg text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <RotateCw size={14} className={isLoadingStatus ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="p-1.5 rounded-lg text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          style={{
            backgroundColor: 'var(--aura-sidebar-toolbar-bg, var(--aura-card-bg, #252526))',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="flex items-center gap-2 px-5 py-2 border-b select-none text-xs"
        >
          <button
            type="button"
            onClick={() => setActiveTab('changes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'changes'
                ? 'bg-[var(--aura-accent,#007acc)]/15 text-[var(--aura-accent,#007acc)] border border-[var(--aura-accent,#007acc)]/30 shadow-xs'
                : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
            }`}
          >
            <FileDiff size={13} />
            <span>Changes</span>
            {changedCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[var(--aura-accent,#007acc)] text-white">
                {changedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'bg-[var(--aura-accent,#007acc)]/15 text-[var(--aura-accent,#007acc)] border border-[var(--aura-accent,#007acc)]/30 shadow-xs'
                : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-text)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent'
            }`}
          >
            <GitCommitIcon size={13} />
            <span>History</span>
            {commits.length > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20 dark:bg-white/10 text-[var(--aura-text-muted)]">
                {commits.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden flex flex-col text-xs">
          {activeTab === 'changes' ? (
            <div className="flex-1 flex flex-col p-5 overflow-hidden">
              {/* Changed files list */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 max-h-[36vh]">
                {changedFiles.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[var(--aura-text-muted)] flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-1">
                      <Check size={20} />
                    </div>
                    <span className="font-medium text-[var(--aura-text)] text-sm">Working tree clean</span>
                    <span className="text-[11px] text-[var(--aura-text-muted)]">No uncommitted changes detected.</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--aura-text-muted)] px-2 pb-1 uppercase tracking-wider">
                      <span>Changed Files</span>
                      <span>{changedFiles.length} file{changedFiles.length === 1 ? '' : 's'}</span>
                    </div>

                    {changedFiles.map((file) => (
                      <div
                        key={file.path}
                        onClick={() => {
                          onClose();
                          if (onSelectFile) onSelectFile(file);
                        }}
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer hover:bg-black/5 dark:hover:bg-white/[0.08] text-[var(--aura-text)] group transition-colors border border-transparent hover:border-[var(--aura-border)]/40"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <FileIcon fileName={file.name} className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate font-mono text-xs">{file.name}</span>
                          <span className="truncate font-mono text-[10px] text-[var(--aura-text-muted)]">
                            {file.path.replace(workspaceDir, '').replace(/^[/\\]/, '')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                              file.gitStatus === 'MODIFIED' || file.gitStatus === 'M'
                                ? 'text-amber-400 bg-amber-400/15'
                                : file.gitStatus === 'ADDED' || file.gitStatus === 'A' || file.gitStatus === 'UNTRACKED' || file.gitStatus === 'U'
                                ? 'text-emerald-400 bg-emerald-400/15'
                                : 'text-rose-400 bg-rose-400/15'
                            }`}
                          >
                            {file.gitStatus || 'M'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Commit & Push input area */}
              <div className="mt-4 pt-4 border-t border-[var(--aura-border)]/40 flex flex-col gap-2.5 flex-shrink-0">
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      handleCommit();
                    }
                  }}
                  placeholder="Commit message (Cmd+Enter or Ctrl+Enter to commit)..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-black/15 dark:bg-black/30 border border-[var(--aura-border)] focus:border-[var(--aura-accent,#007acc)] focus:outline-hidden text-[var(--aura-text)] resize-none font-mono"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--aura-text-muted)] font-mono">
                    {changedFiles.length} file{changedFiles.length === 1 ? '' : 's'} ready to commit
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCommit}
                      disabled={isCommitting || !commitMessage.trim() || changedFiles.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--aura-accent,#007acc)] hover:bg-[#007acc]/90 text-white font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
                    >
                      <GitCommitIcon size={13} className={isCommitting ? 'animate-spin' : ''} />
                      <span>{isCommitting ? 'Committing...' : 'Commit'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePush}
                      disabled={isPushing}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--aura-border)] bg-[var(--aura-card-bg)] hover:bg-black/5 dark:hover:bg-white/10 text-[var(--aura-text)] font-medium text-xs disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
                    >
                      <ArrowUpCircle size={13} className={isPushing ? 'animate-spin' : ''} />
                      <span>{isPushing ? 'Pushing...' : 'Push'}</span>
                    </button>
                  </div>
                </div>

                {feedback && (
                  <div
                    className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-lg font-mono ${
                      feedback.type === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                  >
                    {feedback.type === 'success' ? <Check size={13} /> : <AlertCircle size={13} />}
                    <span>{feedback.message}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden max-h-[60vh]">
              {/* Graph Table Header */}
              <div
                style={{
                  backgroundColor: 'var(--aura-sidebar-toolbar-bg, rgba(0,0,0,0.15))',
                  borderColor: 'var(--aura-border, #333333)',
                }}
                className="flex items-center px-4 py-2 text-[11px] font-semibold text-[var(--aura-text-muted)] border-b uppercase tracking-wider select-none flex-shrink-0"
              >
                <div style={{ width: `${headerGraphWidth}px` }} className="flex-shrink-0">Graph</div>
                <div className="flex-1">Description</div>
              </div>

              {/* Graph Table Rows */}
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {commits.length === 0 ? (
                  <div className="py-14 text-center text-xs text-[var(--aura-text-muted)]">
                    No Git commit history available.
                  </div>
                ) : (
                  graphNodes.map((node) => (
                    <GitCommitRow
                      key={node.commit.hash}
                      node={node}
                      isSelected={selectedCommitHash === node.commit.hash}
                      changedInCommit={commitFilesMap[node.commit.hash] || []}
                      railBaseX={RAIL_BASE_X}
                      laneW={LANE_W}
                      onToggleSelect={() => setSelectedCommitHash(selectedCommitHash === node.commit.hash ? null : node.commit.hash)}
                      onClose={onClose}
                      onOpenDiff={onOpenDiff}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: 'var(--aura-topbar-bg, #1f1f1f)',
            borderColor: 'var(--aura-border, #333333)',
          }}
          className="px-5 py-2.5 border-t flex justify-end"
        >
          <button
            type="button"
            onClick={onClose}
            className="aura-btn-secondary px-4 py-1 text-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
