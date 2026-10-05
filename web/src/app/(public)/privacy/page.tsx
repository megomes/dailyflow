import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy · DailyFlow' };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="hint">Last updated: October 5, 2026</p>
      <p>DailyFlow is a personal, single-user time manager. This policy explains what data it handles and how.</p>

      <h2>Data the app stores</h2>
      <ul>
        <li>What you enter: day plans, time blocks, tracked time, to-dos, notes and preferences.</li>
        <li>Basic technical data needed to run the app: device sessions, sync state and product usage events (which screens and actions are used), kept to improve the app.</li>
      </ul>

      <h2>Google user data</h2>
      <p>If you connect a Google account, DailyFlow requests read-only access to Google Calendar (<code>calendar.readonly</code>) and your email address (to label the connected account).</p>
      <ul>
        <li><strong>Use:</strong> event times, titles and locations are read to show your events as blocks on your day. Nothing is written to your calendar.</li>
        <li><strong>Storage:</strong> OAuth tokens are stored encrypted (AES-GCM) on the server; event data is stored with your day plan in the app database.</li>
        <li><strong>Sharing:</strong> Google user data is not sold, not shared with third parties, not used for advertising and not used to train AI models. It is only shown to you.</li>
        <li><strong>Deletion:</strong> disconnecting the account in Settings › Calendars deletes its tokens and removes its events. You can also revoke access at any time at <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</li>
      </ul>
      <p>DailyFlow’s use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

      <h2>Other calendar links</h2>
      <p>A calendar added by an ICS link is downloaded only to show its events as blocks. The link is stored encrypted and never shown again.</p>

      <h2>Where data lives</h2>
      <p>The app runs on Vercel and stores data in a Neon Postgres database; data is also cached on your own devices so the app works offline.</p>

      <h2>Contact</h2>
      <p>Questions or deletion requests: <a href="mailto:matheuservilha@gmail.com">matheuservilha@gmail.com</a>.</p>
    </>
  );
}
