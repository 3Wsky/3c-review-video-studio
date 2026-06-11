/** @typedef {{ label: string; tone: string }} RetentionGrade */

/** @typedef {{ key: string; label: string; score: number; weight: number; note: string }} RetentionDim */

/** @typedef {{ index: number; title: string; score: number; issues: string[]; isWeak: boolean; pos: number }} RetentionScene */

/** @typedef {{ overall: number; grade: RetentionGrade; dims: RetentionDim[]; scenes: RetentionScene[] }} RetentionReport */

/** @typedef {{ key: string; label: string; status: 'pass'|'warn'|'fail'; score?: number; summary: string; detail: string[] }} GateCheck */

/** @typedef {{ pass: boolean; checks: GateCheck[] }} GateReport */

export {};
