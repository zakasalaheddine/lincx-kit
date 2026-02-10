/**
 * Simple line-by-line diff utility for displaying changes before push.
 */

const ANSI_RED = '\x1b[31m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_DIM = '\x1b[2m';
const ANSI_RESET = '\x1b[0m';

export interface DiffResult {
  /** The formatted diff string (with ANSI colors) */
  formatted: string;
  /** Whether there are any differences */
  hasChanges: boolean;
  /** Number of lines added */
  additions: number;
  /** Number of lines removed */
  deletions: number;
}

/**
 * Generate a unified diff-like output comparing old and new text.
 * Uses simple line-by-line comparison to show additions and deletions
 * with colored output and line numbers.
 */
export function generateDiff(
  oldText: string,
  newText: string,
  filename: string
): DiffResult {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  // If content is identical, return early
  if (oldText === newText) {
    return {
      formatted: `${ANSI_DIM}${filename}: no changes${ANSI_RESET}`,
      hasChanges: false,
      additions: 0,
      deletions: 0,
    };
  }

  const diffLines: string[] = [];
  let additions = 0;
  let deletions = 0;

  // Simple LCS-based diff for better line matching
  const lcs = computeLCS(oldLines, newLines);
  const changes = buildChanges(oldLines, newLines, lcs);

  diffLines.push(`${filename}:`);

  for (const change of changes) {
    const lineNum = String(change.lineNum).padStart(4, ' ');
    if (change.type === 'remove') {
      diffLines.push(`${ANSI_RED}  ${lineNum} - ${change.text}${ANSI_RESET}`);
      deletions++;
    } else if (change.type === 'add') {
      diffLines.push(`${ANSI_GREEN}  ${lineNum} + ${change.text}${ANSI_RESET}`);
      additions++;
    }
  }

  // Add summary line
  const summaryParts: string[] = [];
  if (additions > 0) summaryParts.push(`${ANSI_GREEN}+${additions}${ANSI_RESET}`);
  if (deletions > 0) summaryParts.push(`${ANSI_RED}-${deletions}${ANSI_RESET}`);
  diffLines.push(`  ${summaryParts.join(', ')} line(s)`);

  return {
    formatted: diffLines.join('\n'),
    hasChanges: true,
    additions,
    deletions,
  };
}

interface Change {
  type: 'add' | 'remove';
  text: string;
  lineNum: number;
}

/**
 * Compute the Longest Common Subsequence table for two arrays of lines.
 */
function computeLCS(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Walk the LCS table backwards to produce a list of add/remove changes.
 */
function buildChanges(
  oldLines: string[],
  newLines: string[],
  dp: number[][]
): Change[] {
  const changes: Change[] = [];
  let i = oldLines.length;
  let j = newLines.length;

  // Collect changes in reverse, then reverse at the end
  const reversed: Change[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Line is unchanged, skip
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ type: 'add', text: newLines[j - 1], lineNum: j });
      j--;
    } else if (i > 0) {
      reversed.push({ type: 'remove', text: oldLines[i - 1], lineNum: i });
      i--;
    }
  }

  // Reverse to get the correct order
  for (let k = reversed.length - 1; k >= 0; k--) {
    changes.push(reversed[k]);
  }

  return changes;
}
