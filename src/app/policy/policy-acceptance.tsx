"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client/api";

export function PolicyAcceptance({ signedIn, accepted }: { signedIn: boolean; accepted: boolean }) {
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(accepted);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!signedIn) return <p><a className="button button-primary" href="/login">Sign in to accept the policy</a></p>;
  if (done) return <p className="notice notice-success" role="status">You have accepted this version. <Link href="/courses">Go to courses</Link></p>;
  return <form onSubmit={async (event) => {
    event.preventDefault(); if (!checked || pending) return;
    setPending(true); setError("");
    try { await api("/policy/accept", { body: {} }); setDone(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save acceptance."); }
    finally { setPending(false); }
  }}>
    <label className="check-row"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} required /> I have read and agree to follow this policy before posting.</label>
    <button className="button button-primary" disabled={!checked || pending} type="submit">{pending ? "Saving…" : "Accept policy"}</button>
    {error && <p className="notice notice-danger" role="alert">{error}</p>}
  </form>;
}
