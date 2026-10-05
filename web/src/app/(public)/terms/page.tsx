import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service · DailyFlow' };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p className="hint">Last updated: October 5, 2026</p>
      <ol>
        <li><strong>The service.</strong> DailyFlow is a personal time manager operated by its owner for personal use. Access requires a private access code; there is no public sign-up.</li>
        <li><strong>Your data.</strong> What you enter stays yours. Connected calendars are read-only; see the <a href="/privacy">Privacy Policy</a>.</li>
        <li><strong>Acceptable use.</strong> Do not try to access the service without an access code, disrupt it, or use it to break the law.</li>
        <li><strong>No warranty.</strong> The service is provided “as is”, without warranties of any kind, and may change or stop at any time.</li>
        <li><strong>Liability.</strong> To the extent allowed by law, the operator is not liable for indirect or consequential damages, or for lost data.</li>
        <li><strong>Changes.</strong> These terms may be updated; the date above shows the latest version.</li>
        <li><strong>Contact.</strong> <a href="mailto:matheuservilha@gmail.com">matheuservilha@gmail.com</a>.</li>
      </ol>
    </>
  );
}
