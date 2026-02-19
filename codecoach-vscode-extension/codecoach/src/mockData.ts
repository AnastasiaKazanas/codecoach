export type Assignment = {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  fundamentals: string[];
  objectives: string[];
};

export const MOCK_ASSIGNMENTS: Assignment[] = [
  {
    id: "cs336-hw-greedy-1",
    courseId: "CS336",
    title: "CS 336 — Greedy Scheduling (Demo)",
    fundamentals: ["Greedy choice", "Exchange argument", "Runtime: sorting + scan"],
    objectives: [
      "Choose a greedy strategy",
      "Explain correctness (exchange argument)",
      "Analyze runtime"
    ],
    instructions: [
      "You are given intervals (start, finish).",
      "Pick a maximum-size subset of non-overlapping intervals.",
      "Explain *why* your greedy choice is optimal using an exchange argument.",
      "Do not paste full solution code. Use pseudocode or a toy example."
    ].join("\n")
  },
  {
    id: "cs213-asm-stack-1",
    courseId: "CS213",
    title: "CS 213 — Stack Frames & Calling Convention (Demo)",
    fundamentals: ["SysV AMD64 calling convention", "Stack frames", "rsp movement"],
    objectives: [
      "Explain what push/pop do to rsp",
      "Identify arg registers vs return register",
      "Reason about local stack allocation"
    ],
    instructions: [
      "Given a short x86-64 snippet, explain the stack frame setup/teardown.",
      "Identify where arguments are passed (registers/stack).",
      "Explain what 'sub $0x20, %rsp' implies."
    ].join("\n")
  },
  {
    id: "general-debugging-1",
    courseId: "GEN",
    title: "Debugging Mindset — Minimal Repro (Demo)",
    fundamentals: ["Hypothesis-driven debugging", "Binary search debugging", "Logging"],
    objectives: ["Create a minimal repro", "Isolate the variable that changes behavior"],
    instructions: [
      "Describe the bug in one sentence.",
      "List 3 hypotheses.",
      "Explain the fastest experiment to rule out each hypothesis.",
      "Write a minimal reproduction step-by-step."
    ].join("\n")
  }
];