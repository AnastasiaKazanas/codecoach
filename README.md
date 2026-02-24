# CodeCoach Setup Instructions

---

## Running the Website

### Option 1: Localhost

1. Open: codecoach/codecoach-web
2. Install dependencies: npm install
3. Start dev server: npm run dev
4. Open: http://localhost:3000

---

### Option 2: Hosted (Vercel)

Open:

https://codecoach-anastasiakazanas-projects.vercel.app/

---

## Demo Logins

### Student
- **Email:** student@u.northwestern.edu  
- **Password:** student  

### Instructor
- **Email:** instructor@u.northwestern.edu  
- **Password:** instructor  

---

## Running the CodeCoach VS Code Extension

### Option 1: Run locally (Extension Development Host)

1. Open: codecoach/codecoach-vscode-extension/codecoach
2. Install deps (if needed): npm install
3. Build: npm run compile
4. Start debugging:
- VS Code → Run & Debug → Start Debugging  
- or press `F5`
5. This opens the **Extension Development Host**.
6. In the Extension Development Host, open any folder/file (so the editor has context).
7. Open the CodeCoach chat:
- Click the CodeCoach icon in the left sidebar (activity bar), or  
- Press `Cmd + Shift + P` → run `CodeCoach: Open Chat`

---

### Option 2: Open from the Website

- Go to an assignment page in the web app.
- Click **Open in VS Code**
  - this should auto load in the gemini key and coachcoach key from web app (need to paste your gemini key in settings in web app)
  - should also auto load in assignment
  * need to add so that it auto opens starter files

---

## Backend Database (Supabase)

Supabase backend (Postgres + Auth + API/data layer):

https://supabase.com/dashboard/project/cbdzszcojzxhqqzsyxcc/editor/17455?schema=public

- The website can run locally or on Vercel.
- Data is stored in Supabase.
- The hosted website is deployed on Vercel.


---

## things to work on
- fix assignment connection to vscode
- connect to VSCode link needs to auto open starter files
- learning summary is not working so should get that fixed (both assignment summary and overall) and that connects to profile page of web
- should have some type of submission or way to submit work/ assignment learning summary?

