import Link from "next/link";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";
import { getAppUrl, POLICY_VERSION } from "@/lib/server/env";
import { PolicyAcceptance } from "./policy-acceptance";

export const metadata = { title: "Contribution policy" };

export default async function PolicyPage() {
  const user = await getCurrentUser(new Request(getAppUrl(), { headers: await headers() }));
  const accepted = user ? Boolean(await db.policyAcceptance.findUnique({ where: { userId_version: { userId: user.id, version: POLICY_VERSION } } })) : false;
  return <main className="policy page-container" id="main-content" style={{ maxWidth: 850, margin: "24px auto" }}>
    <Link href={user ? "/courses" : "/login"}>Back to {user ? "courses" : "sign in"}</Link>
    <h1>Contribution policy</h1>
    <p className="muted">Version {POLICY_VERSION}. All contributions show their author’s name and username.</p>
    <section className="panel" style={{ padding: 20 }}>
      <h2>Student-contributed material</h2>
      <p>openTJ is an independent collaboration space, not an official ION, CSL, TJHSST or FCPS service. Verify dates, requirements and course rules with your teacher’s official sources.</p>
      <h2>Academic integrity</h2>
      <p>Post only material you created or are authorized to share. Sample questions must be original practice based on broad skills. They must not reconstruct a protected assessment.</p>
      <h3>Never post</h3>
      <ul>
        <li>Active, recalled, copied, photographed or closely paraphrased assessment questions or answers.</li>
        <li>Answer keys, restricted teacher documents or another person’s work without permission.</li>
        <li>Material intended to provide an unfair advantage or facilitate plagiarism.</li>
        <li>Harassment, hate, threats, obscene content, personal information, impersonation, spam, malicious files or copyright violations.</li>
      </ul>
      <h2>Moderation and appeals</h2>
      <p>Members can report contributions. Assigned course staff moderate their own courses; platform administrators moderate across the site. Actions require reasons and retain an audit record. Authors can appeal a takedown once and see the decision in their course notices.</p>
      <h2>Privacy</h2>
      <p>openTJ stores identity information needed for attribution and authorization. Practice attempts are private to their student, who can clear their history. ION access tokens are discarded after sign-in. Files are available only to authorized course members after validation and malware scanning.</p>
      <PolicyAcceptance signedIn={Boolean(user && user.accountStatus === "ACTIVE")} accepted={accepted} />
    </section>
  </main>;
}
