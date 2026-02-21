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

https://codecoach-6pnemrcye-anastasiakazanas-projects.vercel.app/

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
- Click **Open in VS Code** to auto-connect and load that assignment in the extension.  
*(This flow is still being refined.)*

---

## Connect Your Account (Inside VS Code)

1. In the CodeCoach chat view, click **Connect**.
2. Log in with: student@u.northwestern.edu
3. Copy the student CodeCoach token from the web app:  
Student → Settings → Copy token
4. Paste the token when prompted.

After connecting, you can open an assignment from within the extension.  
*(Connection flow is still being improved.)*

---

## Backend Database (Supabase)

Supabase backend (Postgres + Auth + API/data layer):

https://supabase.com/dashboard/project/cbdzszcojzxhqqzsyxcc/editor/17455?schema=public

- The website can run locally or on Vercel.
- Data is stored in Supabase.
- The hosted website is deployed on Vercel.
