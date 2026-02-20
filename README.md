**Running the website**

Option 1: localhost
	1.	Open: codecoach/codecoach-web
	2.	Install deps (if needed): npm install
	3.	Start dev server: npm run dev
	4.	Open: http://localhost:3000

Option 2: hosted (Vercel)
Open: https://codecoach-6pnemrcye-anastasiakazanas-projects.vercel.app/

Demo logins
	•	Student
        email: student@u.northwestern.edu 
        password: student
	•	Instructor
        email: instructor@u.northwestern.edu
        password: instructor

**Running the CodeCoach VS Code Extension**
Option 1: Run locally in Extension Development Host
	1.	Open: codecoach/codecoach-vscode-extension/codecoach
	2.	Install deps (if needed): npm install
	3.	Build: npm run compile
	4.	Start debugging:
	    •	VS Code → Run & Debug → Start Debugging (or press F5)
	5.	This opens Extension Development Host
	6.	In Extension Development Host, open any folder/file (so the editor has context)
    7. Open the CodeCoach chat
	    •	Click the CodeCoach icon in the left sidebar (the activity bar icon), or
	    •	Cmd + Shift + P → run: CodeCoach: Open Chat

Option 2: Open from the website
	•	Go to an assignment page in the web app
	•	Click Open in VS Code to auto-connect and load that assignment in the extension (currently working on this so might not be perfect)

THEN connect your account
    1.  In the CodeCoach chat view, click Connect
	2.	Log in with: student@u.northwestern.edu
	3.	Copy the student CodeCoach token from the web app (Student → Settings → copy token)
	4.	Paste token when prompted
After connecting you can open an assignment from within the extension. (also working on this connection right now)


**Backend Database (Supabase)**
backend (Postgres + auth + API/data layer):
https://supabase.com/dashboard/project/cbdzszcojzxhqqzsyxcc/editor/17455?schema=public
	•	You can run the website on localhost or use Vercel
	•	Data is stored in Supabase (backend)
	•	The hosted website is deployed on Vercel
