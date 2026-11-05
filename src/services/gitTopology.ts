import { GitCommit } from '../types';

export const VSCODE_SCM_GRAPH_COLORS = [
  '#007acc',
  '#DC267F',
  '#FFB000',
  '#40B0A6',
  '#B66DFF',
  '#994F00',
  '#10b981',
  '#ec4899',
  '#ea580c',
];

export const SWIMLANE_WIDTH = 12;
export const SWIMLANE_HEIGHT = 30;

export interface SwimlaneNode {
  id: string;
  color: string;
}

export interface HistoryItemViewModel {
  commit: GitCommit;
  kind: 'HEAD' | 'node';
  inputSwimlanes: SwimlaneNode[];
  outputSwimlanes: SwimlaneNode[];
  circleIndex: number;
  circleColor: string;
  laneCount: number;
}

export function computeVSCodeHistoryViewModels(
  commits: GitCommit[],
  headHash: string | null = null
): HistoryItemViewModel[] {
  let colorCounter = 0;
  const viewModels: HistoryItemViewModel[] = [];

  for (let index = 0; index < commits.length; index++) {
    const commit = commits[index];
    const kind = commit.hash === headHash || (index === 0 && !headHash) ? 'HEAD' : 'node';

    const prevOutputs = viewModels[index - 1]?.outputSwimlanes ?? [];
    const inputSwimlanes: SwimlaneNode[] = prevOutputs.map((n) => ({ ...n }));
    const outputSwimlanes: SwimlaneNode[] = [];

    const parents = commit.parents || [];
    let firstParentAdded = false;

    if (parents.length > 0) {
      for (const node of inputSwimlanes) {
        if (node.id === commit.hash) {
          if (!firstParentAdded) {
            outputSwimlanes.push({
              id: parents[0],
              color: node.color,
            });
            firstParentAdded = true;
          }
          continue;
        }
        outputSwimlanes.push({ ...node });
      }
    }

    for (let i = firstParentAdded ? 1 : 0; i < parents.length; i++) {
      let color = VSCODE_SCM_GRAPH_COLORS[colorCounter % VSCODE_SCM_GRAPH_COLORS.length];
      colorCounter++;

      outputSwimlanes.push({
        id: parents[i],
        color,
      });
    }

    const inputIndex = inputSwimlanes.findIndex((n) => n.id === commit.hash);
    const circleIndex = inputIndex !== -1 ? inputIndex : inputSwimlanes.length;

    const circleColor =
      circleIndex < outputSwimlanes.length
        ? outputSwimlanes[circleIndex].color
        : circleIndex < inputSwimlanes.length
        ? inputSwimlanes[circleIndex].color
        : VSCODE_SCM_GRAPH_COLORS[0];

    const laneCount = Math.max(inputSwimlanes.length, outputSwimlanes.length, circleIndex + 1, 1);

    viewModels.push({
      commit,
      kind,
      inputSwimlanes,
      outputSwimlanes,
      circleIndex,
      circleColor,
      laneCount,
    });
  }

  return viewModels;
}
