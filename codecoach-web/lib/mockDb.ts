export type Role = "student" | "instructor";

export type Course = {
  id: string;
  title: string;
  term: string;
  joinCode: string;
  ownerEmail: string; // instructor email
};

export type ResourceLink = { title: string; url: string };

export type StarterFileAsset = {
  path: string;
  filename: string;
  mime: string;
  dataUrl: string;
};

export type StarterBundle = {
  files: StarterFileAsset[];
};

export type StarterAsset = {
  filename: string;
  mime: string;
  dataUrl: string; // base64 data URL (MVP)
};

export type Assignment = {
  id: string;
  courseId: string;
  title: string;

  instructionsHtml: string;
  instructions?: string;

  fundamentals: string[];
  objectives: string[];

  tutorialUrl?: string;
  starterBundle?: StarterBundle | null;
};

export type Enrollment = {
  courseId: string;
  studentEmail: string;
};

export type Submission = {
  assignmentId: string;
  studentEmail: string;
  submittedAtISO: string;
  traceCount: number;
  summarySnippet: string;
};

export type CourseProfile = {
  courseId: string;
  studentEmail: string;
  updatedAtISO: string;
  topics: string[];
  mastered: string[];
  developing: string[];
  notes: string;
};

export type StudentOverallProfile = {
  studentEmail: string;
  updatedAtISO: string;
  topics: string[];
  mastered: string[];
  developing: string[];
  notes: string;
};

type DB = {
  courses: Course[];
  assignments: Assignment[];
  enrollments: Enrollment[];
  submissions: Submission[];
  profiles: CourseProfile[];
  overallProfiles: StudentOverallProfile[];
  seeded: boolean;
};

const KEY = "codecoach.mockdb.v1";

function empty(): DB {
  return {
    courses: [],
    assignments: [],
    enrollments: [],
    submissions: [],
    profiles: [],
    overallProfiles: [],
    seeded: false,
  };
}

function load(): DB {
  if (typeof window === "undefined") return empty();
  const raw = localStorage.getItem(KEY);
  if (!raw) return empty();
  try {
    const parsed = JSON.parse(raw) as Partial<DB>;
    return {
      ...empty(),
      ...parsed,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      overallProfiles: Array.isArray((parsed as any).overallProfiles)
        ? (parsed as any).overallProfiles
        : [],
    };
  } catch {
    return empty();
  }
}

function save(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function mkJoinCode(prefix: string) {
  return `NU-${prefix}-${Math.floor(100 + Math.random() * 900)}`;
}

function uniq(arr: string[]) {
  return Array.from(
    new Set((arr || []).map((s) => (s ?? "").toString().trim()).filter(Boolean))
  );
}

function mergeProfile(oldP: CourseProfile, patch: Partial<CourseProfile>): CourseProfile {
  const mastered = uniq([...(oldP.mastered || []), ...((patch.mastered as string[]) || [])]);
  const developingRaw = uniq([...(oldP.developing || []), ...((patch.developing as string[]) || [])]);
  const developing = developingRaw.filter((x) => !mastered.includes(x));
  const topics = uniq([...(oldP.topics || []), ...((patch.topics as string[]) || [])]);

  return {
    ...oldP,
    updatedAtISO: new Date().toISOString(),
    mastered,
    developing,
    topics,
    notes: typeof patch.notes === "string" && patch.notes.trim() ? patch.notes : oldP.notes,
  };
}

/** -----------------------
 *  SEED DATA (CS110 demo)
 *  ---------------------- */
const SEED_INSTRUCTOR = "instructor@u.northwestern.edu";
const SEED_STUDENT = "student@u.northwestern.edu";

const SEED_COURSE_ID = "CS110";
const SEED_JOIN_CODE = "NU-CS110-110-DEMO";

const SEED_COURSE: Course = {
  id: SEED_COURSE_ID,
  title: "CS 110: Intro to Computer Programming with Python",
  term: "Spring 2026",
  joinCode: SEED_JOIN_CODE,
  ownerEmail: SEED_INSTRUCTOR,
};

const HW1_INSTRUCTIONS_HTML = `
<h2>Assignments &gt; HW1: Installation &amp; Introductory Exercises</h2>
<p><strong>Due on:</strong> Fri, 10/01 @ 11:59PM<br/>
<strong>Points:</strong> 8</p>

<hr />

<h3>Part 1: Install Python and IDLE</h3>

<h4>What if I’ve already installed Python on my laptop?</h4>
<p>
Note: many people who have programmed with Python before already have Python 3.x installed.
To check, search for an existing Python installation. If you already have a version of Python3 installed,
move on to Part 2. It doesn’t hurt to install another version of Python, but it’s not necessary.
If you have any questions, feel free to ask Sarah or one of the peer mentors / TAs.
</p>

<p>
We will use the Python 3 programming language and IDLE, which is Python’s Integrated Development and Learning Environment.
</p>

<p>
Download the latest version (3.9.x) of Python here:
<a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">https://www.python.org/downloads/</a>
</p>

<p>
After going through the installation process, navigate to the folder on your machine where Python was installed.
For me, on a Mac, my IDLE was saved to Applications &gt; Python 3.9 (or you can also search for it).
For Windows users, it will likely be in a folder inside of Program Files (which you can also search for).
</p>

<p>
Inside the Python 3.9 folder, you’ll find a file called <strong>IDLE</strong> — this is the IDLE executable.
Double click on that file to run it. (The example screen shows version 3.8, but any 3.x version is OK.)
</p>

<p>
I recommend keeping IDLE in your dock (on a Mac) or making a Desktop Shortcut to IDLE (on Windows).
</p>

<p>
At the <code>&gt;&gt;&gt;</code> prompt, you can type any valid Python command. For example:
</p>

<pre><code>print("hello world!")</code></pre>

<p>
If you have any issues installing Python or IDLE, contact your assigned peer mentor.
You are also welcome to attend any of the course office hours to get help.
</p>

<hr />

<h3>Part 2: Complete the Programming Exercises</h3>

<p>
In the section above, you wrote a single line of Python at the <code>&gt;&gt;&gt;</code> prompt (for instance, <code>print("hello world!")</code>).
However, in this class, you’ll be writing larger programs that are saved as files that end with the <code>.py</code> extension.
By writing your code in a file and then running that file, you will be able to execute many lines of code at once.
</p>

<h4>Step 1: Organize yourself!</h4>
<p>
File management and organization are an essential part of programming. As such, we suggest the following system:
</p>

<ul>
  <li>Create a course folder: <code>cs110</code></li>
  <li>Create a homework folder inside of the <code>cs110</code> folder</li>
  <li>Create a <code>hw01</code> folder inside of your homework folder</li>
</ul>

<p>Sample file structure (there will be course lecture files as well):</p>

<pre><code>cs110
  |-- homework
  |   |-- hw01
  |   |-- hw02
  |   ...
  |
  |-- lectures
  |   |-- lecture_01
  |   |-- lecture_02
  |   |-- lecture_03
  |   ...
  |
  |-- tutorials
      |-- tutorial_01
      |-- tutorial_02
      ...</code></pre>

<p>
It may seem trivial, but take some time now to organize yourself. It will save you time in the long run!
</p>

<h4>Step 2: Complete the following exercises</h4>
<p>
Download the <code>main.py</code> starter file and save it in your <code>hw01</code> folder. To edit <code>main.py</code> using IDLE:
</p>

<ol>
  <li>Right click on the <code>main.py</code> file you saved and open it with IDLE.</li>
  <li>Click anywhere inside that file so your cursor is in that window.</li>
  <li>Hit <strong>F5</strong> (on Mac Touch Bar: <code>fn</code> + <code>F5</code>). Alternatively: Run &gt; Run Module.</li>
  <li>Your code will then be executed by the Python interpreter.</li>
</ol>

<p>
When you’re done, please complete the following 9 exercises by editing <code>main.py</code>.
</p>

<h4>Exercises</h4>

<ol>
  <li>
    <p>Print a box like the one below:</p>
    <pre><code>*******************
*******************
*******************
*******************</code></pre>
  </li>

  <li>
    <p>Print a box like the one below:</p>
    <pre><code>*******************
*                 *
*                 *
*******************</code></pre>
  </li>

  <li>
    <p>Print a triangle like the one below:</p>
    <pre><code>*
**
***
****</code></pre>
  </li>

  <li>
    <p>Write a program that computes and prints the result of:</p>
    <p><em>(The answer is roughly 0.1017).</em></p>
  </li>

  <li>
    <p><strong>User input</strong></p>
    <p>
      Ask the user to enter a number. Convert it to an int, and print out the square of the number,
      but use the <code>end</code> optional argument to print it out in a full sentence that ends in a period.
      Example: “The square of 5 is 25.”
    </p>
    <pre><code>Enter a number: 5
The square of 5 is 25.</code></pre>
  </li>

  <li>
    <p><strong>Practice with the <code>sep</code> optional parameter</strong></p>
    <p>
      Ask the user to enter a number <code>x</code>. Use the <code>sep</code> optional argument to print out
      <code>x</code>, <code>2x</code>, <code>3x</code>, <code>4x</code>, and <code>5x</code>, each separated by three dashes.
    </p>
    <pre><code>Enter a number: 7
7---14---21---28---35</code></pre>
  </li>

  <li>
    <p><strong>Math Practice</strong></p>
    <p>
      Write a program that asks the user for a weight in kilograms and converts it to pounds.
      There are 2.2 pounds in a kilogram.
    </p>
    <pre><code>Enter weight in kg: 5
5 kilograms is 11.0 pounds.</code></pre>
  </li>

  <li>
    <p><strong>Calculate Average</strong></p>
    <p>
      Ask the user to enter three numbers (use three separate input statements).
      Create variables called <code>total</code> and <code>average</code> that hold the sum and average of the three numbers.
      Print out the values of <code>total</code> and <code>average</code>.
    </p>
  </li>

  <li>
    <p><strong>Tip Calculator</strong></p>
    <p>
      Ask the user for the price of the meal and the percent tip they want to leave.
      Then print both the tip amount and the total bill with the tip included.
    </p>
  </li>
</ol>

<hr />

<h3>What to Submit</h3>
<p>
Please submit your <code>main.py</code> file that includes code that successfully implements the nine exercises listed above
(which come from the Heinold book). Before each exercise, use comments (or keep the existing ones) to indicate the number
of the exercise that your code corresponds to.
</p>
`;

const SEED_ASSIGNMENTS: Assignment[] = [
  {
    id: "cs110-hw1",
    courseId: SEED_COURSE_ID,
    title: "HW1 — Installation & Introductory Exercises",
    instructionsHtml: HW1_INSTRUCTIONS_HTML,
    instructions: "",
    fundamentals: ["python installation", "IDLE", "print", "input", "types", "basic math"],
    objectives: ["install python", "run a .py file", "practice print/input", "write simple programs"],
    tutorialUrl: "https://www.python.org/downloads/",
    starterBundle: null,
  },
  {
    id: "cs110-hw2",
    courseId: SEED_COURSE_ID,
    title: "HW2: Intro to Tkinter",
    instructionsHtml: `
<h2>HW2: Intro to Tkinter</h2>
<p>
In this assignment, you are going to get some practice writing functions using tkinter that will ultimately enable you to create more complex shapes (like animals, trees, plants, etc.). To do this, we will be using a built-in Python module: <strong>tkinter</strong>. Tkinter provides support for creating custom graphical user interfaces (GUIs). Please download the homework starter files above.
</p>

<hr />

<h3>1. Background Information</h3>

<h4>Coordinate System</h4>
<p>
To draw your shapes, you will be using an (x, y) coordinate space that has a different origin from the one you use in math class. For computer graphics, the origin is typically in the <strong>top-left corner</strong>. To help you debug, I have created a function <code>make_grid</code> in <code>helpers.py</code> that will draw gridlines for you.
</p>

<p><strong>Coordinate system reference image:</strong></p>
<img src="https://eecs110.github.io/fall2021/assets/images/hw02/grid.svg" alt="Coordinate system diagram" />

<p>
Source:
<a href="https://processing.org/tutorials/coordinatesystemandshapes" target="_blank" rel="noreferrer">
https://processing.org/tutorials/coordinatesystemandshapes
</a>
</p>

<h4>Tkinter Sample Code</h4>
<p>
To get you started, I created a file of samples located in <code>warm_up.py</code>. You can use this as a reference as you learn how to draw shapes using the tkinter canvas library. Feel free to copy and adapt code from this file to complete your assignment.
</p>

<p>When you run <code>warm_up.py</code> from IDLE (press F5), you should see an image similar to this:</p>
<img src="https://eecs110.github.io/fall2021/assets/images/hw02/warmup.png" alt="Warmup example screenshot" />

<h4>main.py (file you will edit)</h4>
<p>
In <code>main.py</code>, there is initialization code at the top of the file that imports the Canvas and Tk modules and initializes the window and canvas. There is also a drawing loop at the bottom of the file that renders your drawing. Do not modify this setup code. Add your work between the commented lines.
</p>

<pre><code>from tkinter import Canvas, Tk
from helpers import make_grid
gui = Tk()
gui.title('Shapes')
c = Canvas(gui, width=700, height=700, background='white')
c.pack()
########### YOUR CODE BELOW THIS LINE ###########
# All of your code will go in between these two lines:
########### YOUR CODE ABOVE THIS LINE ###########
c.mainloop()</code></pre>

<h4>Documentation</h4>
<p>
You may need to refer to the tkinter canvas documentation:
<a href="https://anzeljg.github.io/rin2/book2/2405/docs/tkinter/canvas.html" target="_blank" rel="noreferrer">
Canvas Documentation
</a>.
Learning to read technical documentation is an important programming skill.
</p>

<hr />

<h3>2. Your Tasks</h3>

<h4>1. Modify <code>make_oval</code></h4>
<p>Modify the function so that it calculates the top-left and bottom-right coordinates based on:</p>
<ul>
  <li><code>center</code> (tuple)</li>
  <li><code>radius_x</code> (int)</li>
  <li><code>radius_y</code> (int)</li>
  <li><code>fill</code> (optional color string)</li>
</ul>
<p>Currently the function draws a hard-coded oval. Replace the hard-coded values with computed coordinates.</p>

<hr />

<h4>2. Modify <code>make_circle</code></h4>
<p>Modify the function so the circle is drawn using the passed-in:</p>
<ul>
  <li><code>center</code></li>
  <li><code>radius</code></li>
  <li><code>fill</code></li>
</ul>
<p><strong>Hint:</strong> You may call your <code>make_oval</code> function.</p>

<hr />

<h4>3. Modify <code>make_face</code></h4>
<p>Draw a face (a circle) with two oval eyes using your helper functions. The eyes should scale with the width of the face.</p>

<hr />

<h4>4. Modify <code>make_bullseye</code></h4>
<p>Draw 4 concentric circles centered at the given point.</p>
<ul>
  <li>The smallest circle has radius = <code>radius</code></li>
  <li>Each additional circle increases by <code>distance</code></li>
</ul>
<p>Example: if <code>radius = 10</code> and <code>distance = 5</code>, the radii are: 10, 15, 20, 25.</p>
<p><strong>Important:</strong> Draw the largest circle first so smaller ones are visible.</p>

<hr />

<h3>Testing</h3>
<p>When finished, your program should render an image similar to this:</p>
<img src="https://eecs110.github.io/fall2021/assets/images/hw02/final-screenshot.png" alt="Final output example" />

<hr />

<h3>3. What to Submit</h3>
<p>Zip the entire <code>hw02</code> folder and name it <code>hw02.zip</code>. We will grade <code>main.py</code>, but submit all files together due to dependencies.</p>

<hr />

<h3>4. Mac Users: The Tkinter Bug</h3>
<p>
Some newer MacOS laptops experience a tkinter bug that causes shutdown/log out when running files. If this happens:
</p>
<ol>
  <li>Continue editing your file in IDLE.</li>
  <li>Do NOT press F5.</li>
  <li>Use Terminal instead.</li>
</ol>
<p>Run your file using:</p>
<pre><code>pythonw your_file.py</code></pre>
<p>Note the <code>w</code> in <code>pythonw</code>. Ask your TA if you need help.</p>
    `.trim(),
    instructions: "",
    fundamentals: ["modules", "documentation", "import", "functions", "parameters", "return values"],
    objectives: ["read module docs", "import and use modules", "write your own functions"],
    tutorialUrl: undefined,
    starterBundle: null,
  },
];

const SEED_ENROLLMENTS: Enrollment[] = [
  { courseId: SEED_COURSE_ID, studentEmail: SEED_STUDENT },
];

export function seedIfNeeded() {
  const db = load();

  db.courses = Array.isArray(db.courses) ? db.courses : [];
  db.assignments = Array.isArray(db.assignments) ? db.assignments : [];
  db.enrollments = Array.isArray(db.enrollments) ? db.enrollments : [];
  db.submissions = Array.isArray(db.submissions) ? db.submissions : [];
  db.profiles = Array.isArray((db as any).profiles) ? (db as any).profiles : [];
  db.overallProfiles = Array.isArray((db as any).overallProfiles) ? (db as any).overallProfiles : [];

  // ensure CS110 seed is present
  if (!db.courses.some((c) => c.id === SEED_COURSE_ID)) {
    db.courses.push(SEED_COURSE);
  }

  for (const a of SEED_ASSIGNMENTS) {
    if (!db.assignments.some((x) => x.id === a.id)) db.assignments.push(a);
  }

  for (const e of SEED_ENROLLMENTS) {
    const exists = db.enrollments.some(
      (x) =>
        x.courseId === e.courseId &&
        x.studentEmail.toLowerCase() === e.studentEmail.toLowerCase()
    );
    if (!exists) db.enrollments.push(e);
  }

  db.seeded = true;
  save(db);
}

/* STUDENT */
export function joinCourseByCode(studentEmail: string, joinCode: string) {
  const db = load();
  const course = db.courses.find(
    (c) => c.joinCode.toLowerCase() === joinCode.trim().toLowerCase()
  );
  if (!course) throw new Error("Invalid join code.");

  const already = db.enrollments.some(
    (e) => e.courseId === course.id && e.studentEmail === studentEmail
  );
  if (!already) db.enrollments.push({ courseId: course.id, studentEmail });

  save(db);
  return course;
}

export function getStudentCourses(studentEmail: string) {
  const db = load();
  const courseIds = new Set(
    db.enrollments
      .filter((e) => e.studentEmail === studentEmail)
      .map((e) => e.courseId)
  );
  return db.courses.filter((c) => courseIds.has(c.id));
}

export function getCourse(courseId: string) {
  const db = load();
  const c = db.courses.find((x) => x.id === courseId);
  if (!c) throw new Error("Course not found.");
  return c;
}

export function getCourseAssignments(courseId: string) {
  const db = load();
  return db.assignments.filter((a) => a.courseId === courseId);
}

export function getAssignment(assignmentId: string) {
  const db = load();
  const a = db.assignments.find((x) => x.id === assignmentId);
  if (!a) throw new Error("Assignment not found.");
  return a;
}

/* PROFILES */
export function getCourseProfile(courseId: string, studentEmail: string): CourseProfile {
  const db = load();
  const existing = db.profiles.find(
    (p) => p.courseId === courseId && p.studentEmail === studentEmail
  );
  if (existing) return existing;

  const created: CourseProfile = {
    courseId,
    studentEmail,
    updatedAtISO: new Date().toISOString(),
    topics: [],
    mastered: [],
    developing: [],
    notes: "",
  };
  db.profiles.push(created);
  save(db);
  return created;
}

export function upsertCourseProfile(
  courseId: string,
  studentEmail: string,
  update: Partial<Pick<CourseProfile, "topics" | "mastered" | "developing" | "notes">>
) {
  const db = load();
  const idx = db.profiles.findIndex(
    (p) => p.courseId === courseId && p.studentEmail === studentEmail
  );

  if (idx < 0) {
    const created: CourseProfile = {
      courseId,
      studentEmail,
      updatedAtISO: new Date().toISOString(),
      topics: uniq(update.topics || []),
      mastered: uniq(update.mastered || []),
      developing: uniq(update.developing || []),
      notes: (update.notes || "").toString(),
    };
    db.profiles.push(created);
    save(db);
    return created;
  }

  const merged = mergeProfile(db.profiles[idx], update as any);
  db.profiles[idx] = merged;
  save(db);
  return merged;
}

/* INSTRUCTOR */
export function createCourse(ownerEmail: string, title: string, term: string) {
  const db = load();
  const c: Course = {
    id: uid("course"),
    title: title.trim(),
    term: term.trim(),
    joinCode: mkJoinCode(title.trim().split(" ")[0]?.toUpperCase() || "COURSE"),
    ownerEmail,
  };
  db.courses.push(c);
  save(db);
  return c;
}

export function getInstructorCourses(ownerEmail: string) {
  const db = load();
  return db.courses.filter((c) => c.ownerEmail === ownerEmail);
}

export function getRoster(courseId: string) {
  const db = load();
  return db.enrollments
    .filter((e) => e.courseId === courseId)
    .map((e) => e.studentEmail);
}

export function getSubmissionsForCourse(courseId: string) {
  const db = load();
  const assignmentIds = new Set(
    db.assignments.filter((a) => a.courseId === courseId).map((a) => a.id)
  );
  return db.submissions.filter((s) => assignmentIds.has(s.assignmentId));
}

export function getSubmissionsForStudentInCourse(courseId: string, studentEmail: string) {
  const db = load();
  const assignmentIds = new Set(
    db.assignments.filter((a) => a.courseId === courseId).map((a) => a.id)
  );
  return db.submissions.filter(
    (s) => s.studentEmail === studentEmail && assignmentIds.has(s.assignmentId)
  );
}

export function getSubmissionsForAssignment(assignmentId: string) {
  const db = load();
  return db.submissions.filter((s) => s.assignmentId === assignmentId);
}

export function createAssignment(
  courseId: string,
  payload: {
    title: string;
    instructionsHtml: string;
    fundamentals?: string[];
    objectives?: string[];
    tutorialUrl?: string;
    starterBundle?: StarterBundle | null;
  }
) {
  const db = load();
  const c = db.courses.find((x) => x.id === courseId);
  if (!c) throw new Error("Course not found.");

  const a: Assignment = {
    id: uid("asmt"),
    courseId,
    title: payload.title.trim(),

    instructionsHtml: payload.instructionsHtml?.trim() || "<p></p>",
    instructions: "",

    fundamentals: payload.fundamentals || [],
    objectives: payload.objectives || [],

    tutorialUrl: payload.tutorialUrl?.trim() || undefined,
    starterBundle: payload.starterBundle ?? null,
  };

  db.assignments.push(a);
  save(db);
  return a;
}

/* record a submission */
export function upsertSubmission(input: {
  assignmentId: string;
  studentEmail: string;
  traceCount: number;
  summarySnippet: string;
}) {
  const db = load();
  const idx = db.submissions.findIndex(
    (s) => s.assignmentId === input.assignmentId && s.studentEmail === input.studentEmail
  );

  const record: Submission = {
    assignmentId: input.assignmentId,
    studentEmail: input.studentEmail,
    submittedAtISO: new Date().toISOString(),
    traceCount: input.traceCount,
    summarySnippet: input.summarySnippet,
  };

  if (idx >= 0) db.submissions[idx] = record;
  else db.submissions.push(record);

  save(db);
  return record;
}

/* submission + optional profile update (what your student UI will call) */
export function upsertSubmissionWithProfile(input: {
  assignmentId: string;
  studentEmail: string;
  traceCount: number;
  summarySnippet: string;
  topics?: string[];
  mastered?: string[];
  developing?: string[];
  notes?: string;
}) {
  const a = getAssignment(input.assignmentId);

  const sub = upsertSubmission({
    assignmentId: input.assignmentId,
    studentEmail: input.studentEmail,
    traceCount: input.traceCount,
    summarySnippet: input.summarySnippet,
  });

  if (input.topics || input.mastered || input.developing || input.notes) {
    upsertCourseProfile(a.courseId, input.studentEmail, {
      topics: input.topics || [],
      mastered: input.mastered || [],
      developing: input.developing || [],
      notes: input.notes || "",
    });
  }

  return sub;
}

function uniqStrings(arr: string[]) {
  return Array.from(
    new Set((arr || []).map((s) => (s ?? "").toString().trim()).filter(Boolean))
  );
}

function mergeOverall(oldP: StudentOverallProfile, patch: Partial<StudentOverallProfile>): StudentOverallProfile {
  const mastered = uniqStrings([...(oldP.mastered || []), ...((patch.mastered as string[]) || [])]);
  const developingRaw = uniqStrings([...(oldP.developing || []), ...((patch.developing as string[]) || [])]);
  const developing = developingRaw.filter((x) => !mastered.includes(x));
  const topics = uniqStrings([...(oldP.topics || []), ...((patch.topics as string[]) || [])]);

  return {
    ...oldP,
    updatedAtISO: new Date().toISOString(),
    mastered,
    developing,
    topics,
    notes: typeof patch.notes === "string" && patch.notes.trim() ? patch.notes : oldP.notes,
  };
}

export function getAllCourseProfilesForStudent(studentEmail: string) {
  const db = load();
  return db.profiles.filter((p) => p.studentEmail === studentEmail);
}

export function getOverallProfile(studentEmail: string): StudentOverallProfile {
  const db = load();
  const existing = db.overallProfiles.find((p) => p.studentEmail === studentEmail);
  if (existing) return existing;

  const cps = db.profiles.filter((p) => p.studentEmail === studentEmail);
  const mastered = uniqStrings(cps.flatMap((p) => p.mastered || []));
  const developingRaw = uniqStrings(cps.flatMap((p) => p.developing || []));
  const developing = developingRaw.filter((x) => !mastered.includes(x));
  const topics = uniqStrings(cps.flatMap((p) => p.topics || []));

  const created: StudentOverallProfile = {
    studentEmail,
    updatedAtISO: new Date().toISOString(),
    topics,
    mastered,
    developing,
    notes: "",
  };
  db.overallProfiles.push(created);
  save(db);
  return created;
}

export function recomputeOverallProfile(studentEmail: string) {
  const db = load();
  const cps = db.profiles.filter((p) => p.studentEmail === studentEmail);

  const mastered = uniqStrings(cps.flatMap((p) => p.mastered || []));
  const developingRaw = uniqStrings(cps.flatMap((p) => p.developing || []));
  const developing = developingRaw.filter((x) => !mastered.includes(x));
  const topics = uniqStrings(cps.flatMap((p) => p.topics || []));

  const idx = db.overallProfiles.findIndex((p) => p.studentEmail === studentEmail);
  const next: StudentOverallProfile = {
    studentEmail,
    updatedAtISO: new Date().toISOString(),
    topics,
    mastered,
    developing,
    notes: idx >= 0 ? db.overallProfiles[idx].notes : "",
  };

  if (idx >= 0) db.overallProfiles[idx] = next;
  else db.overallProfiles.push(next);

  save(db);
  return next;
}

export function upsertOverallProfile(
  studentEmail: string,
  update: Partial<Pick<StudentOverallProfile, "topics" | "mastered" | "developing" | "notes">>
) {
  const db = load();
  const idx = db.overallProfiles.findIndex((p) => p.studentEmail === studentEmail);

  if (idx < 0) {
    const created: StudentOverallProfile = {
      studentEmail,
      updatedAtISO: new Date().toISOString(),
      topics: uniqStrings(update.topics || []),
      mastered: uniqStrings(update.mastered || []),
      developing: uniqStrings(update.developing || []),
      notes: (update.notes || "").toString(),
    };
    db.overallProfiles.push(created);
    save(db);
    recomputeOverallProfile(studentEmail);
    return created;
  }

  const merged = mergeOverall(db.overallProfiles[idx], update as any);
  db.overallProfiles[idx] = merged;
  save(db);
  recomputeOverallProfile(studentEmail);
  return merged;
}