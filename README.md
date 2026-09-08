Recruitment OC Queue
A real-time applicant check-in and interview queuing system, built with Next.js and Firebase Firestore, ready to deploy on Vercel.
Features
Bulk import applicants from an Excel/CSV file (Name, Reg No, Dept)
Search applicants by name, registration number, or department
Check-in queue: applicants are ordered by the time they were checked in — first to arrive is first in line, later arrivals queue below
A checkbox to mark an interview as finished
Live counts: Interviewed, Waiting, Not Arrived
Manually add / remove applicants
All OCs viewing the page see updates instantly (Firestore real-time sync)
Excel/CSV import format
The importer looks for these column headers (case-insensitive, several common variants and Google Form-style long headers accepted):
Field	Required?	Accepted headers
Name	Yes	`Name`, `Student Name`, `Full Name`
Reg No	Yes	`Reg No`, `Reg. No.`, `Registration Number`, `Registration No`
VIT Mail	No	`VIT Mail ID`, `VIT Email`
Phone	No	`Phone Number`, `Phone`, `Mobile Number`
Year of Study	No	`Year of Study`, `Year`
Slot	No	`Select your slot`, `Slot`
Residence	No	`Select from the following`, `Hosteller/Day Scholar`, `Residence`
Dept (1st/2nd/3rd pref.)	No	Any header containing "department" plus "1st/2nd/3rd preference" (matches Google Form headers like `Which department would you like to volunteer for? [1st preference]`)
Reason	No	Any header containing "reason"
Experience	No	Any header containing "experience" or "skill"
Design portfolio link	No	Any header containing "portfolio" + "design", or "decor"
Media portfolio link	No	Any header containing "media portfolio" or "best works"
GitHub link	No	Any header containing "github"
Rows missing a Name or Reg No are skipped, and you'll see a summary of how many rows were imported vs. skipped after upload. You can import multiple files — new rows are added on top of existing ones (duplicates aren't automatically merged, so avoid uploading the same file twice).
Only Name, Reg No, and the three department preferences show directly on each card by default. Reason, experience, and portfolio/GitHub links are imported but tucked behind a "Show details" toggle on each card to keep the queue view scannable.
How the queue works
When an OC hits Check In for an applicant, that moment is recorded.
The Interview Queue section always lists checked-in, not-yet-interviewed applicants ordered by check-in time — whoever checked in first appears at position #1.
Ticking Interviewed moves them out of the queue into Completed.
Unchecking Check In (e.g. a mistake) drops them back to Not Arrived and clears their queue position.
1. Create a Firebase project
Go to https://console.firebase.google.com and create a new project.
In the project, go to Build > Firestore Database and click Create database (start in production mode).
Go to Project settings > General, scroll to "Your apps", click the Web (`</>`) icon, and register an app (no need for Firebase Hosting).
Copy the `firebaseConfig` values shown — you'll need them in step 3.
2. Set Firestore security rules
Go to Firestore Database > Rules and use something like this to start (locks writes to signed-in OCs only if you add auth later; for a quick internal tool behind a private link, this open version works but should be tightened before public use):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /applicants/{applicantId} {
      allow read, write: if true;
    }
  }
}
```
Note: `allow read, write: if true` means anyone with the URL can read/write data. For a real event, at minimum restrict this to your OC team, e.g. by adding Firebase Authentication and checking `request.auth != null`. Ask if you'd like this added.
3. Configure environment variables
Copy `.env.local.example` to `.env.local` and fill in the values from your Firebase config:
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```
4. Run locally
```
npm install
npm run dev
```
Visit http://localhost:3000
5. Deploy to Vercel
Push this project to a GitHub repo.
Go to https://vercel.com/new and import the repo.
In the Vercel project's Settings > Environment Variables, add the same six `NEXT_PUBLIC_FIREBASE_*` variables from your `.env.local`.
Deploy. Vercel will give you a live URL to share with your OC team.
Data model
Each applicant is a document in the `applicants` Firestore collection:
```
{
  name: string,
  regNumber: string,
  arrived: boolean,
  interviewed: boolean,
  createdAt: timestamp
}
```
Possible next steps
Bulk import applicants from a CSV/spreadsheet of registrations
Add Firebase Authentication so only logged-in OCs can access the page
Add a "called in for interview" status between Waiting and Interviewed
Export the final list (with timestamps) at the end of the day