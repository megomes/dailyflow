import { redirect } from 'next/navigation';

/**
 * Forest is switched off for now (note #24): the old grid was not worth keeping, and the redesign
 * (stage EF, “Floresta viva”) waits for a later decision. `src/lib/forest.ts` stays for that.
 */
export default function ForestPage() {
  redirect('/');
}
