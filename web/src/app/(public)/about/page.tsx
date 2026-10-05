import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'DailyFlow', description: 'A personal time manager: plan the day, track what really happened.' };

export default function AboutPage() {
  return (
    <>
      <h1>DailyFlow</h1>
      <p className="lead">A personal time manager. Plan the day in blocks, track what really happened, and compare the two.</p>
      <h2>What it does</h2>
      <ul>
        <li>Today: a plan of time blocks (baseline and current) next to the actual time you tracked.</li>
        <li>To-dos per block, an inbox and a backlog.</li>
        <li>Now / Next on the web, an Android widget and a Wear OS watch.</li>
        <li>Optional calendar connection: your Google Calendar events are read (read-only) and shown as blocks on your day, so meetings are part of the plan.</li>
      </ul>
      <h2>Who it is for</h2>
      <p>DailyFlow is a single-user app run by its owner for personal use. Access requires a private access code.</p>
      <p>See the <Link href="/privacy">Privacy Policy</Link> and the <Link href="/terms">Terms of Service</Link>.</p>
    </>
  );
}
