import { useEffect, useState } from 'react';
import { 
  Activity, 
  Cpu, 
  Database, 
  Layers, 
  Play, 
  Pause,
  XCircle,
  RefreshCw, 
  Smartphone, 
  Terminal, 
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, signInWithGoogle } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

// Types from blueprint
interface Node {
  id: string;
  status: 'online' | 'offline' | 'busy';
  lastSeen: any;
  adbReverseActive: boolean;
  storagePermissions: boolean;
}

interface Job {
  id: string;
  projectName: string;
  status: 'pending' | 'rendering' | 'paused' | 'cancelled' | 'completed' | 'failed';
  progress: number;
  renderPath?: string;
  updatedAt: any;
}

interface Telemetry {
  nodeId: string;
  cpuUsage: number;
  memUsage?: number;
  ffmpegStatus?: string;
  timestamp: any;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen for nodes
    const nodesUnsub = onSnapshot(collection(db, 'nodes'), (snap) => {
      setNodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Node)));
    });

    // Listen for recent jobs
    const jobsQuery = query(collection(db, 'jobs'), orderBy('updatedAt', 'desc'), limit(5));
    const jobsUnsub = onSnapshot(jobsQuery, (snap) => {
      setJobs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job)));
    });

    // Listen for latest telemetry
    const telQuery = query(collection(db, 'telemetry'), orderBy('timestamp', 'desc'), limit(1));
    const telUnsub = onSnapshot(telQuery, (snap) => {
      if (!snap.empty) {
        setTelemetry({ ...snap.docs[0].data() } as Telemetry);
      }
    });

    return () => {
      nodesUnsub();
      jobsUnsub();
      telUnsub();
    };
  }, [user]);

  const handleJobAction = async (jobId: string, action: 'pause' | 'resume' | 'cancel') => {
    setActionLoading(jobId);
    const newStatus = action === 'pause' ? 'paused' : action === 'resume' ? 'rendering' : 'cancelled';
    
    try {
      // 1. Update Firestore
      const jobRef = doc(db, 'jobs', jobId);
      await updateDoc(jobRef, {
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      // 2. Signal local orchestrator via ADB tunnel
      // We use try/catch here as the tunnel might not be active
      try {
        await fetch(`http://localhost:3000/jobs/${jobId}/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.warn('[Pipeline] Signal to local orchestrator failed (tunnel might be down):', err);
      }
    } catch (error) {
      console.error('[Pipeline] Job action failed:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchAction = async (action: 'pause' | 'cancel') => {
    const targetJobs = jobs.filter(j => 
      action === 'pause' ? j.status === 'rendering' : ['pending', 'rendering', 'paused'].includes(j.status)
    );
    
    if (targetJobs.length === 0) return;

    setActionLoading('batch');
    try {
      // Process in sequence to avoid overwhelming the tunnel if many
      for (const job of targetJobs) {
        await handleJobAction(job.id, action);
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-8">
          <Layers className="w-10 h-10 text-emerald-500" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Dragon 9 Media Pipeline</h1>
        <p className="text-slate-400 max-w-md mb-8">
          High-fidelity control center for fluid motion animation and 432Hz harmonic audio rendering.
        </p>
        <button 
          onClick={signInWithGoogle}
          className="px-8 py-3 bg-white text-slate-950 font-semibold rounded-full hover:bg-slate-100 transition-all flex items-center gap-2"
        >
          Authenticate Control Node
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center">
              <Layers className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Dragon 9</h1>
              <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">Media Pipeline</span>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-500">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ADB Tunnel Active
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-medium text-white">{user.displayName}</p>
                <p className="text-[10px] text-slate-500 uppercase">{user.email === 'fluidmotiontv@gmail.com' ? 'System Administrator' : 'Operator'}</p>
              </div>
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-white/10" />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Node Status & Telemetry */}
        <div className="lg:col-span-1 space-y-6">
          <section>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Smartphone className="w-3 h-3" />
              Active Nodes
            </h2>
            <div className="space-y-3">
              {nodes.length === 0 ? (
                <div className="p-4 rounded-xl border border-white/5 bg-white/5 text-sm text-slate-500">
                  No nodes registered. Run bootstrap script on device.
                </div>
              ) : (
                nodes.map(node => (
                  <div key={node.id} className="p-4 rounded-xl border border-white/5 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${node.status === 'online' ? 'bg-emerald-500' : node.status === 'busy' ? 'bg-amber-500' : 'bg-slate-500'}`} />
                      <div>
                        <p className="text-sm font-semibold text-white">{node.id}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Termux Environment</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {node.adbReverseActive && <Database className="w-3 h-3 text-emerald-500" title="ADB Tunnel" />}
                      {node.storagePermissions && <CheckCircle2 className="w-3 h-3 text-emerald-500" title="Storage Access" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Activity className="w-3 h-3" />
              Live Telemetry
            </h2>
            <div className="p-6 rounded-2xl border border-white/5 bg-white/5 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Cpu className="w-3 h-3" /> CPU Load
                  </span>
                  <span className="font-mono text-emerald-500">{telemetry ? (telemetry.cpuUsage * 100).toFixed(1) : '0.0'}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${telemetry ? Math.min(telemetry.cpuUsage * 100, 100) : 0}%` }}
                    className="h-full bg-emerald-500" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="flex items-center gap-2 text-slate-400">
                    <Database className="w-3 h-3" /> Memory Usage
                  </span>
                  <span className="font-mono text-blue-500">{telemetry?.memUsage ? (telemetry.memUsage * 100).toFixed(1) : '0.0'}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${telemetry?.memUsage ? Math.min(telemetry.memUsage * 100, 100) : 0}%` }}
                    className="h-full bg-blue-500" 
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase">FFmpeg Status</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-mono">
                  {telemetry?.ffmpegStatus || 'IDLE'}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Jobs & Controls */}
        <div className="lg:col-span-2 space-y-6">
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-1">
                  <Play className="w-3 h-3" />
                  Render Pipeline
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">Active Queue Management</p>
              </div>
              
              {user.email === 'fluidmotiontv@gmail.com' && jobs.some(j => ['pending', 'rendering'].includes(j.status)) && (
                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/5">
                  <button 
                    onClick={() => handleBatchAction('pause')}
                    disabled={!!actionLoading}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-amber-500 hover:bg-amber-500/10 rounded transition-colors flex items-center gap-1.5"
                  >
                    <Pause className="w-3 h-3" />
                    Pause All
                  </button>
                  <div className="w-px h-3 bg-white/10" />
                  <button 
                    onClick={() => handleBatchAction('cancel')}
                    disabled={!!actionLoading}
                    className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-tight text-rose-500 hover:bg-rose-500/10 rounded transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-3 h-3" />
                    Cancel All
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {jobs.length === 0 ? (
                <div className="p-12 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-center">
                  <Terminal className="w-8 h-8 text-slate-700 mx-auto mb-4" />
                  <p className="text-sm text-slate-500">No active rendering jobs detected.</p>
                </div>
              ) : (
                jobs.map(job => (
                  <div key={job.id} className="p-5 rounded-2xl border border-white/5 bg-white/5 group hover:bg-white/[0.07] transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 
                          job.status === 'failed' || job.status === 'cancelled' ? 'bg-rose-500/10 text-rose-500' : 
                          job.status === 'paused' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-blue-500/10 text-blue-500 animate-pulse'
                        }`}>
                          {job.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                           job.status === 'failed' || job.status === 'cancelled' ? <AlertCircle className="w-5 h-5" /> : 
                           job.status === 'paused' ? <Pause className="w-5 h-5" /> :
                           <RefreshCw className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white">{job.projectName}</h3>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                            {job.status} · {new Date(job.updatedAt?.seconds * 1000).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="text-lg font-mono font-bold text-white">{job.progress}%</span>
                        </div>
                        
                        {/* Inline Actions */}
                        {user.email === 'fluidmotiontv@gmail.com' && (
                          <div className="flex items-center gap-1">
                            {job.status === 'rendering' && (
                              <button 
                                onClick={() => handleJobAction(job.id, 'pause')}
                                disabled={actionLoading === job.id}
                                className="p-2 hover:bg-amber-500/10 text-slate-500 hover:text-amber-500 rounded-lg transition-colors"
                                title="Pause Rendering"
                              >
                                <Pause className="w-4 h-4" />
                              </button>
                            )}
                            {job.status === 'paused' && (
                              <button 
                                onClick={() => handleJobAction(job.id, 'resume')}
                                disabled={actionLoading === job.id}
                                className="p-2 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-500 rounded-lg transition-colors"
                                title="Resume Rendering"
                              >
                                <Play className="w-4 h-4" />
                              </button>
                            )}
                            {(job.status === 'rendering' || job.status === 'paused') && (
                              <button 
                                onClick={() => handleJobAction(job.id, 'cancel')}
                                disabled={actionLoading === job.id}
                                className="p-2 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-lg transition-colors"
                                title="Cancel Job"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${job.progress}%` }}
                        className={`h-full ${
                          job.status === 'completed' ? 'bg-emerald-500' : 
                          job.status === 'failed' || job.status === 'cancelled' ? 'bg-rose-500' : 
                          job.status === 'paused' ? 'bg-amber-500' :
                          'bg-blue-500'
                        }`}
                      />
                    </div>

                    {job.status === 'completed' && job.renderPath && (
                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px]">
                          {job.renderPath}
                        </span>
                        <button className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter hover:underline">
                          Inspect Output
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-white font-bold mb-1">Super Puff Pilot Pipeline</h3>
                <p className="text-xs text-slate-400 max-w-sm mb-4">
                  Trigger the 3-minute high-fidelity pilot render. This will engage all connected nodes and apply 432Hz harmonic tuning.
                </p>
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-emerald-500 text-slate-950 text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-emerald-400 transition-colors">
                    <Play className="w-3 h-3 fill-current" />
                    Start Pilot Render
                  </button>
                  <button className="px-4 py-2 bg-white/5 text-white text-xs font-bold rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                    Asset Settings
                  </button>
                </div>
              </div>
              <div className="hidden sm:block">
                <Layers className="w-12 h-12 text-emerald-500/20" />
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="border-t border-white/5 bg-slate-950 py-3 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] text-slate-500 uppercase font-bold tracking-widest">
            <span>System Ready</span>
            <span className="text-white/10">|</span>
            <span className="text-emerald-500">Fluidmotion Engine v9.0.1</span>
          </div>
          <div className="text-[10px] text-slate-500">
            © 2026 FluidmotionTV · 9COMB-DRAGON9
          </div>
        </div>
      </footer>
    </div>
  );
}
