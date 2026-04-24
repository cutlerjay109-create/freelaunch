"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, CONTRACT_ABI, STATUS, STATUS_COLORS } from "../lib/contract";

interface Job {
  id: bigint;
  client: string;
  freelancer: string;
  title: string;
  description: string;
  amount: bigint;
  deadline: bigint;
  workLink: string;
  revisionNote: string;
  status: number;
}

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export default function Home() {
  const [address, setAddress] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"browse" | "create" | "myjobs">("browse");
  const [form, setForm] = useState({ title: "", description: "", days: "3", amount: "" });
  const [workLink, setWorkLink] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState("");
  const [balance, setBalance] = useState("0");
  const [stats, setStats] = useState({ earned: 0, spent: 0, completed: 0, posted: 0 });
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionJobId, setRevisionJobId] = useState<string | null>(null);

  const RPC = process.env.NEXT_PUBLIC_EVM_RPC || "http://localhost:8545";
  const CHAIN_HEX = "0x82c6e8d35d20d";

  const getProvider = () => new ethers.JsonRpcProvider(RPC);
  const getSigner = async () => new ethers.BrowserProvider((window as any).ethereum).getSigner();
  const getContract = (s?: any) => new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, s || getProvider());

  const connect = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("Please install MetaMask");
      return;
    }
    try {
      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      setAddress(accounts[0]);
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: CHAIN_HEX }],
        });
      } catch (e: any) {
        if (e.code === 4902) {
          await (window as any).ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: CHAIN_HEX,
              chainName: "FreeLaunch",
              nativeCurrency: { name: "GAS", symbol: "GAS", decimals: 18 },
              rpcUrls: [RPC],
            }],
          });
        }
      }
    } catch (e) {
      console.log("Connect cancelled");
    }
  };

  const disconnect = () => {
    setAddress("");
    setBalance("0");
    setStats({ earned: 0, spent: 0, completed: 0, posted: 0 });
  };

  const loadJobs = useCallback(async () => {
    try {
      const c = getContract();
      const count = Number(await c.jobCount());
      const all: Job[] = [];
      for (let i = 1; i <= count; i++) {
        const j = await c.getJob(i);
        all.push({
          id: BigInt(j.id ?? j[0]),
          client: String(j.client ?? j[1]),
          freelancer: String(j.freelancer ?? j[2]),
          title: String(j.title ?? j[3] ?? ""),
          description: String(j.description ?? j[4] ?? ""),
          amount: BigInt(j.amount ?? j[5]),
          deadline: BigInt(j.deadline ?? j[6]),
          workLink: String(j.workLink ?? j[7] ?? ""),
          revisionNote: String(j.revisionNote ?? j[8] ?? ""),
          status: Number(j.status ?? j[9]),
        });
      }
      setJobs(all);
    } catch (e) {
      console.error("Load jobs failed:", e);
    }
  }, []);

  const loadBalance = async (addr: string) => {
    try {
      const bal = await getProvider().getBalance(addr);
      setBalance(parseFloat(ethers.formatEther(bal)).toFixed(2));
    } catch (e) {}
  };

  useEffect(() => { loadJobs(); }, [loadJobs]);
  useEffect(() => { if (address) loadBalance(address); }, [address]);

  useEffect(() => {
    if (!address) return;
    const lo = address.toLowerCase();
    const completed = jobs.filter(j => j.status === 3 && j.freelancer.toLowerCase() === lo).length;
    const posted = jobs.filter(j => j.client.toLowerCase() === lo).length;
    const earned = jobs.filter(j => j.status === 3 && j.freelancer.toLowerCase() === lo)
      .reduce((s, j) => s + parseFloat(ethers.formatEther(j.amount)), 0);
    const spent = jobs.filter(j => j.status === 3 && j.client.toLowerCase() === lo)
      .reduce((s, j) => s + parseFloat(ethers.formatEther(j.amount)), 0);
    setStats({
      completed, posted,
      earned: parseFloat(earned.toFixed(2)),
      spent: parseFloat(spent.toFixed(2)),
    });
  }, [jobs, address]);

  const runTx = async (fn: () => Promise<any>, pending: string, success: string) => {
    try {
      setLoading(true);
      setTxStatus(pending);
      const t = await fn();
      setTxStatus("Confirming on chain...");
      await t.wait();
      setTxStatus(success);
      await loadJobs();
      if (address) await loadBalance(address);
    } catch (e: any) {
      const msg = e.shortMessage || e.reason || e.message || "Transaction failed";
      setTxStatus("Error: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const createJob = async () => {
    if (!form.title || !form.description || !form.amount) {
      setTxStatus("Please fill all fields");
      return;
    }
    const s = await getSigner();
    await runTx(
      () => getContract(s).createJob(form.title, form.description, parseInt(form.days), { value: ethers.parseEther(form.amount) }),
      "Creating job and locking funds...",
      "Job created successfully!"
    );
    setForm({ title: "", description: "", days: "3", amount: "" });
    setActiveTab("browse");
  };

  const acceptJob = async (id: bigint) => {
    const s = await getSigner();
    await runTx(() => getContract(s).acceptJob(id), "Accepting job...", "Job accepted!");
  };

  const submitWork = async (id: bigint) => {
    if (!workLink.trim()) { setTxStatus("Please enter a work link"); return; }
    const s = await getSigner();
    await runTx(() => getContract(s).submitWork(id, workLink), "Submitting work...", "Work submitted!");
    setWorkLink("");
    setSelectedJobId(null);
  };

  const releasePayment = async (id: bigint) => {
    const s = await getSigner();
    await runTx(() => getContract(s).releasePayment(id), "Releasing payment...", "Payment released to freelancer!");
  };

  const requestRevision = async (id: bigint) => {
    if (!revisionNote.trim()) { setTxStatus("Please enter a revision note"); return; }
    const s = await getSigner();
    await runTx(() => getContract(s).requestRevision(id, revisionNote), "Sending revision request...", "Revision requested!");
    setRevisionNote("");
    setRevisionJobId(null);
  };

  const reassignJob = async (id: bigint) => {
    const s = await getSigner();
    await runTx(() => getContract(s).reassignJob(id), "Reassigning job...", "Job is now open again!");
  };

  const cancelJob = async (id: bigint) => {
    const s = await getSigner();
    await runTx(() => getContract(s).cancelJob(id), "Cancelling job...", "Job cancelled, funds refunded!");
  };

  const short = (a: string) => a && a !== ZERO_ADDR ? a.slice(0, 6) + "..." + a.slice(-4) : "";
  const hasRevisionNote = (n: string) => n && n.trim().length > 0 && n !== ZERO_ADDR;

  const myJobs = address ? jobs.filter(j =>
    j.client.toLowerCase() === address.toLowerCase() ||
    j.freelancer.toLowerCase() === address.toLowerCase()
  ) : [];

  const openJobs = jobs.filter(j => j.status === 0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FreeLaunch</h1>
            <p className="text-sm text-gray-500">Trustless freelance payments on Initia</p>
          </div>
          {address ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">{short(address)}</span>
              <button onClick={disconnect} className="text-sm text-red-600 hover:text-red-700 font-medium">Disconnect</button>
            </div>
          ) : (
            <button onClick={connect} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Connect Wallet</button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 flex-1 w-full">
        {txStatus && (
          <div className={"mb-6 p-4 rounded-lg text-sm font-medium " + (
            txStatus.startsWith("Error") ? "bg-red-50 text-red-700" :
            txStatus.endsWith("!") ? "bg-green-50 text-green-700" :
            "bg-blue-50 text-blue-700"
          )}>
            {txStatus}
            <button onClick={() => setTxStatus("")} className="ml-4 underline">dismiss</button>
          </div>
        )}

        {address && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard label="Balance" value={balance} sub="GAS" color="text-gray-900" />
            <StatCard label="Jobs Posted" value={stats.posted} sub="as client" color="text-blue-600" />
            <StatCard label="Completed" value={stats.completed} sub="as freelancer" color="text-green-600" />
            <StatCard label="Total Earned" value={stats.earned} sub="GAS" color="text-green-600" />
            <StatCard label="Total Spent" value={stats.spent} sub="GAS" color="text-purple-600" />
          </div>
        )}

        <div className="flex gap-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          {(["browse", "create", "myjobs"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={"px-4 py-2 rounded-md text-sm font-medium capitalize transition-all " +
                (activeTab === tab ? "bg-white shadow text-gray-900" : "text-gray-600 hover:text-gray-900")}>
              {tab === "myjobs" ? "My Jobs" : tab === "browse" ? ("Browse (" + openJobs.length + ")") : "Post Job"}
            </button>
          ))}
        </div>

        {activeTab === "browse" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Open Jobs</h2>
            {openJobs.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-4xl mb-3">📋</p>
                <p>No open jobs yet.</p>
                <button onClick={() => setActiveTab("create")} className="mt-3 text-blue-600 hover:underline text-sm">Post the first one →</button>
              </div>
            ) : (
              <div className="grid gap-4">
                {openJobs.map(job => (
                  <div key={job.id.toString()} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{job.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">by {short(job.client)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">{ethers.formatEther(job.amount)} GAS</p>
                        <span className={"text-xs px-2 py-1 rounded-full " + STATUS_COLORS[job.status]}>{STATUS[job.status]}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{job.description}</p>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-400">Deadline: {new Date(Number(job.deadline) * 1000).toLocaleDateString()}</p>
                      {address && job.client.toLowerCase() !== address.toLowerCase() && (
                        <button onClick={() => acceptJob(job.id)} disabled={loading}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                          Accept Job
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "create" && (
          <div className="max-w-lg">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Post a New Job</h2>
            {!address ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">Please connect your wallet to post a job.</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                <Field label="Job Title">
                  <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Build a landing page" className={inputCls} />
                </Field>
                <Field label="Description">
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe the work needed..." rows={3} className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Budget (GAS)">
                    <input value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} type="number" min="0" placeholder="10" className={inputCls} />
                  </Field>
                  <Field label="Deadline (days)">
                    <input value={form.days} onChange={e => setForm({ ...form, days: e.target.value })} type="number" min="1" className={inputCls} />
                  </Field>
                </div>
                <button onClick={createJob} disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
                  {loading ? "Processing..." : "Post Job & Lock Funds"}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "myjobs" && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Jobs</h2>
            {!address ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">Please connect your wallet to view your jobs.</div>
            ) : myJobs.length === 0 ? (
              <div className="text-center py-16 text-gray-500"><p className="text-4xl mb-3">🗂️</p><p>No jobs yet.</p></div>
            ) : (
              <div className="grid gap-4">
                {myJobs.map(job => {
                  const isClient = job.client.toLowerCase() === address.toLowerCase();
                  const isFreelancer = job.freelancer.toLowerCase() === address.toLowerCase();
                  const jobIdStr = job.id.toString();
                  return (
                    <div key={jobIdStr} className="bg-white rounded-xl border border-gray-200 p-6">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{job.title}</h3>
                          <p className="text-sm text-gray-500 mt-1">{isClient ? "You are the client" : "You are the freelancer"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{ethers.formatEther(job.amount)} GAS</p>
                          <span className={"text-xs px-2 py-1 rounded-full " + STATUS_COLORS[job.status]}>{STATUS[job.status]}</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{job.description}</p>

                      {job.workLink && job.workLink.length > 0 && (
                        <p className="text-sm text-blue-600 mb-3">
                          Work: <a href={job.workLink} target="_blank" rel="noopener noreferrer" className="underline">{job.workLink}</a>
                        </p>
                      )}

                      {/* Revision note — only shows if there IS a note AND the job is back in Active status (freelancer needs to redo) */}
                      {hasRevisionNote(job.revisionNote) && job.status === 1 && (
                        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-xs font-medium text-yellow-800">📝 Revision Note from Client:</p>
                          <p className="text-sm text-yellow-700 mt-1">{job.revisionNote}</p>
                        </div>
                      )}

                      {/* Freelancer submit work */}
                      {job.status === 1 && isFreelancer && (
                        <div className="flex gap-2 mt-3">
                          {selectedJobId === jobIdStr ? (
                            <>
                              <input value={workLink} onChange={e => setWorkLink(e.target.value)} placeholder="https://github.com/..." className={"flex-1 " + inputCls} />
                              <button onClick={() => submitWork(job.id)} disabled={loading} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">Submit</button>
                              <button onClick={() => { setSelectedJobId(null); setWorkLink(""); }} className="text-gray-400 hover:text-gray-600 px-2 text-sm">Cancel</button>
                            </>
                          ) : (
                            <button onClick={() => setSelectedJobId(jobIdStr)} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700">
                              {hasRevisionNote(job.revisionNote) ? "Resubmit Work" : "Submit Work"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Client 3 buttons when work is submitted (PendingReview) */}
                      {job.status === 2 && isClient && (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => releasePayment(job.id)} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">✅ Release Payment</button>
                            <button onClick={() => reassignJob(job.id)} disabled={loading} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">🔄 Reassign Job</button>
                          </div>
                          {revisionJobId === jobIdStr ? (
                            <div className="flex gap-2">
                              <input value={revisionNote} onChange={e => setRevisionNote(e.target.value)} placeholder="Describe what needs to change..." className={"flex-1 " + inputCls} />
                              <button onClick={() => requestRevision(job.id)} disabled={loading} className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50">Send</button>
                              <button onClick={() => { setRevisionJobId(null); setRevisionNote(""); }} className="text-gray-400 hover:text-gray-600 px-2 text-sm">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setRevisionJobId(jobIdStr)} className="bg-yellow-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600">📝 Request Revision</button>
                          )}
                        </div>
                      )}

                      {/* Client can cancel if job is still open */}
                      {job.status === 0 && isClient && (
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => cancelJob(job.id)} disabled={loading} className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600 disabled:opacity-50">Cancel & Refund</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

    </div>
  );
}

const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={"text-xl font-bold " + color}>{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}
