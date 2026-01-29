import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect authenticated users directly to transcripts
  redirect('/transcripts');
}
