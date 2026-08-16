import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Activity,
  Braces,
  ChevronDown,
  CircleDot,
  Code2,
  Cpu,
  ExternalLink,
  FileCode2,
  GitCompareArrows,
  HardDrive,
  Eye,
  Layers3,
  PanelLeft,
  Play,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Square,
  TerminalSquare,
  Workflow,
  X,
} from 'lucide-react';
import { examples, layerMeta, traceCommand, updateTeachingState } from './traces';

const createInitialTeachingState = () => ({ cwd: '/', mounts: { ext2: '', fat32: '' } });
const INITIAL_TEACHING_STATE = createInitialTeachingState();

function TraceNode({ data }) {
  const meta = layerMeta[data.layer];
  return (
    <button
      className={`trace-node tone-${meta.tone} ${data.selected ? 'is-selected' : ''}`}
      style={{ '--delay': `${data.index * 55}ms` }}
      aria-label={`查看 ${data.title} 节点详情`}
    >
      <Handle type="target" position={data.targetPosition || Position.Top} />
      <span className="trace-node__step">{String(data.index + 1).padStart(2, '0')}</span>
      <span className="trace-node__body">
        <span className="trace-node__meta">{meta.label}</span>
        <strong>{data.title}</strong>
        <code>{data.fn}</code>
      </span>
      <span className="trace-node__file">{data.file.replace('src/', '')}:{data.line}</span>
      <Handle type="source" position={data.sourcePosition || Position.Bottom} />
    </button>
  );
}

const nodeTypes = { trace: TraceNode };

function TraceCanvas({ trace, selectedId, onSelect, viewKey }) {
  const { fitView, getViewport, setViewport } = useReactFlow();
  const flowNodes = useMemo(() => {
    const columnFor = (index) => {
      const row = Math.floor(index / 2);
      return row % 2 === 0 ? index % 2 : 1 - (index % 2);
    };
    return trace.nodes.map((item, index) => {
      const row = Math.floor(index / 2);
      const column = columnFor(index);
      const previousRow = index > 0 ? Math.floor((index - 1) / 2) : -1;
      const nextRow = index + 1 < trace.nodes.length ? Math.floor((index + 1) / 2) : -1;
      const targetPosition = previousRow === row
        ? (columnFor(index - 1) < column ? Position.Left : Position.Right)
        : Position.Top;
      const sourcePosition = nextRow === row
        ? (columnFor(index + 1) > column ? Position.Right : Position.Left)
        : Position.Bottom;
      return {
        id: item.id,
        type: 'trace',
        position: { x: column === 0 ? 24 : 292, y: row * 112 },
        data: { ...item, index, selected: item.id === selectedId, targetPosition, sourcePosition },
        draggable: false,
      };
    });
  }, [trace, selectedId]);
  const edges = useMemo(() => trace.nodes.slice(0, -1).map((item, index) => ({
    id: `${item.id}-${trace.nodes[index + 1].id}`,
    source: item.id,
    target: trace.nodes[index + 1].id,
    type: 'smoothstep',
    animated: index < 3,
    style: { stroke: index % 3 === 1 ? '#e06c2b' : '#2e766f', strokeWidth: 1.6 },
  })), [trace]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      await fitView({ padding: 0.12, minZoom: 0.68, maxZoom: 1, duration: 0 });
      const viewport = getViewport();
      await setViewport({ ...viewport, y: 14 }, { duration: 350 });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [trace.raw, viewKey, fitView, getViewport, setViewport]);

  return (
    <ReactFlow
      nodes={flowNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={(_event, selected) => onSelect(selected.id)}
      nodesConnectable={false}
      nodesFocusable
      minZoom={0.58}
      maxZoom={1.25}
      proOptions={{ hideAttribution: true }}
      colorMode="light"
    >
      <Background color="#c8cdc9" gap={24} size={1} />
      <Controls showInteractive={false} position="bottom-right" />
    </ReactFlow>
  );
}

function SourceView({ node }) {
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setSource(null);
    setError('');
    fetch(`/api/source?file=${encodeURIComponent(node.file)}&line=${node.line}`)
      .then((response) => response.ok ? response.json() : response.json().then((body) => Promise.reject(new Error(body.error))))
      .then((body) => active && setSource(body))
      .catch((reason) => active && setError(reason.message));
    return () => { active = false; };
  }, [node.file, node.line]);

  if (error) return <div className="source-empty">{error}</div>;
  if (!source) return <div className="source-empty">正在读取当前仓库源码…</div>;
  return (
    <div className="source-view" role="region" aria-label="源码上下文">
      {source.lines.map((item) => (
        <div key={item.number} className={item.number === source.focus ? 'source-line is-focus' : 'source-line'}>
          <span>{item.number}</span>
          <code>{item.text || ' '}</code>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({ node, onClose }) {
  const [tab, setTab] = useState('explain');
  useEffect(() => setTab('explain'), [node.id]);

  return (
    <section className="detail-panel">
      <header className="detail-header">
        <div>
          <span className={`layer-tag tone-${layerMeta[node.layer].tone}`}>{layerMeta[node.layer].label}</span>
          <h2>{node.title}</h2>
          <code>{node.fn}</code>
        </div>
        <button className="icon-button" onClick={onClose} title="关闭节点详情" aria-label="关闭节点详情"><X size={17} /></button>
      </header>
      <div className="detail-tabs" role="tablist">
        <button className={tab === 'explain' ? 'active' : ''} onClick={() => setTab('explain')}>节点解释</button>
        <button className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}>源码上下文</button>
      </div>
      {tab === 'source' ? <SourceView node={node} /> : (
        <div className="detail-content">
          <p className="node-role">{node.role}</p>
          {node.params?.length > 0 && (
            <div className="parameter-section">
              <h3>参数与字段</h3>
              <div className="parameter-table">
                {node.params.map((item) => (
                  <div className="parameter-row" key={`${node.id}-${item.name}`}>
                    <code>{item.name}</code>
                    <span className="parameter-type">{item.type}</span>
                    <span>{item.meaning}</span>
                    {item.value && <strong>{item.value}</strong>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {node.variables?.length > 0 && (
            <div className="variable-strip">
              {node.variables.map((item) => (
                <span key={item.name}><code>{item.name}</code>{item.meaning}<strong>{item.value}</strong></span>
              ))}
            </div>
          )}
          <button className="source-link" onClick={() => setTab('source')}>
            <FileCode2 size={15} /> {node.file}:{node.line} <ExternalLink size={13} />
          </button>
        </div>
      )}
    </section>
  );
}

function TerminalPanel({
  arch,
  mode,
  onModeChange,
  runtime,
  session,
  terminalHostRef,
  onRestart,
  onStop,
  onExample,
}) {
  const [examplesOpen, setExamplesOpen] = useState(false);
  return (
    <section className="terminal-panel">
      <header className="terminal-toolbar">
        <div className="terminal-title">
          <span className="terminal-lights" aria-hidden="true"><i /><i /><i /></span>
          <TerminalSquare size={16} />
          <strong>xv6@handsome-os</strong>
          <span className="terminal-path">{arch === 'riscv' ? 'riscv64' : 'loongarch64'}:/</span>
        </div>
        <div className="terminal-actions">
          <div className="mode-control" aria-label="会话模式">
            <button className={mode === 'demo' ? 'active' : ''} onClick={() => onModeChange('demo')}>快速</button>
            <button
              className={mode === 'real' ? 'active' : ''}
              onClick={() => onModeChange('real')}
              title={runtime.realAvailable ? '连接本机真实 QEMU' : runtime.reason}
              disabled={!runtime.realAvailable}
            >真实 QEMU</button>
          </div>
          <button className="icon-button on-dark" onClick={onRestart} title="重启内核" aria-label="重启内核"><RefreshCw size={15} /></button>
          <button className="icon-button on-dark" onClick={onStop} title="停止会话" aria-label="停止会话"><Square size={14} /></button>
        </div>
      </header>
      <div className="terminal-stage">
        <div ref={terminalHostRef} className="xterm-host" />
      </div>
      <footer className="terminal-footer">
        <div className={`session-state state-${session.state}`}>
          <CircleDot size={13} />
          <span>{session.state === 'running' ? '内核运行中' : session.state === 'booting' ? '正在启动 QEMU' : '会话已停止'}</span>
          <strong>{session.mode === 'real' ? 'REAL' : 'DEMO'}</strong>
          {session.note && <em>{session.note}</em>}
        </div>
        <div className="examples-menu">
          <button className="examples-trigger" onClick={() => setExamplesOpen((value) => !value)}>
            <Play size={13} /> 教学命令 <ChevronDown size={13} />
          </button>
          {examplesOpen && (
            <div className="examples-popover">
              {examples.map((item) => (
                <button key={item.label} onClick={() => { onExample(item.command); setExamplesOpen(false); }}>
                  <span>{item.label}</span><code>{item.command.replaceAll('\n', ' → ')}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </section>
  );
}

function App() {
  const terminalHostRef = useRef(null);
  const terminalRef = useRef(null);
  const fitRef = useRef(null);
  const socketRef = useRef(null);
  const commandBufferRef = useRef('');
  const teachingStateRef = useRef(INITIAL_TEACHING_STATE);
  const sessionConfigRef = useRef({ arch: 'riscv', mode: 'demo' });
  const aiEnabledRef = useRef(false);
  const aiRuntimeRef = useRef({ available: false, reason: '正在探测 AI 服务' });
  const analysisRequestRef = useRef({ id: 0, controller: null });
  const lastCommandRef = useRef(null);
  const [arch, setArch] = useState('riscv');
  const [mode, setMode] = useState('demo');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiTask, setAiTask] = useState({ state: 'idle', trace: null, note: '' });
  const [showAi, setShowAi] = useState(false);
  const [aiRuntime, setAiRuntime] = useState({ available: false, model: '', reason: '正在探测 AI 服务' });
  const [runtime, setRuntime] = useState({ realAvailable: false, reason: '正在探测本机环境' });
  const [session, setSession] = useState({ state: 'booting', mode: 'demo', note: '' });
  const [trace, setTrace] = useState(() => traceCommand('ls /', INITIAL_TEACHING_STATE));
  const [selectedId, setSelectedId] = useState('lookup');
  const [activeMobilePane, setActiveMobilePane] = useState('terminal');
  const selectedNode = trace.nodes.find((item) => item.id === selectedId) || null;

  useEffect(() => { sessionConfigRef.current = { arch, mode }; }, [arch, mode]);

  const requestAiTrace = useCallback(async (input, baseTrace) => {
    analysisRequestRef.current.controller?.abort();
    const controller = new AbortController();
    const requestId = analysisRequestRef.current.id + 1;
    analysisRequestRef.current = { id: requestId, controller };
    setAiTask({ state: 'running', trace: null, note: '正在后台检索并核对仓库源码' });
    try {
      const response = await fetch('/api/ai/trace', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ ...input, baseTrace }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'AI 分析失败');
      if (analysisRequestRef.current.id !== requestId || !aiEnabledRef.current) return;
      setAiTask({ state: 'ready', trace: body.trace, note: body.trace.analysisNote || 'AI 分析已通过源码校验' });
    } catch (error) {
      if (error.name === 'AbortError' || analysisRequestRef.current.id !== requestId) return;
      setAiTask({ state: 'error', trace: null, note: `AI 分析失败：${error.message}` });
    }
  }, []);

  const commitCommand = useCallback((raw, result = null) => {
    const command = raw.trim();
    if (!command) return;
    const current = teachingStateRef.current;
    const nextTrace = traceCommand(command, current, result);
    const input = {
      command,
      state: current,
      result,
      arch: sessionConfigRef.current.arch,
      terminalMode: sessionConfigRef.current.mode,
    };
    lastCommandRef.current = { input, baseTrace: nextTrace };
    teachingStateRef.current = updateTeachingState(command, current, result);
    setShowAi(false);
    setTrace(nextTrace);
    setSelectedId(nextTrace.nodes.find((item) => item.layer === 'vfs')?.id || nextTrace.nodes[0]?.id);
    if (aiEnabledRef.current) requestAiTrace(input, nextTrace);
    else setAiTask({ state: 'idle', trace: null, note: '' });
  }, [requestAiTrace]);

  useEffect(() => {
    let active = true;
    let runtimeTimer = null;
    const refreshRuntime = () => {
      fetch('/api/runtime').then((response) => response.json()).then((status) => {
        if (!active) return;
        setRuntime(status);
        if (status.probing) runtimeTimer = window.setTimeout(refreshRuntime, 500);
      }).catch(() => {});
    };
    refreshRuntime();
    fetch('/api/ai/status').then((response) => response.json()).then((status) => {
      aiRuntimeRef.current = status;
      setAiRuntime(status);
    }).catch(() => {
      const status = { available: false, model: '', reason: '无法连接 AI 状态接口' };
      aiRuntimeRef.current = status;
      setAiRuntime(status);
    });

    const terminal = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontFamily: '"JetBrains Mono", "Cascadia Mono", Consolas, monospace',
      fontSize: 16,
      lineHeight: 1.42,
      scrollback: 4000,
      // QEMU's serial console emits bare LF characters. Keep every new line
      // aligned to column zero, as a hardware terminal would.
      convertEol: true,
      theme: {
        background: '#101412',
        foreground: '#d9e2dc',
        cursor: '#ff9252',
        cursorAccent: '#101412',
        selectionBackground: '#315b50',
        black: '#101412', red: '#ef7759', green: '#85c9a3', yellow: '#e2ba68',
        blue: '#73a5d7', magenta: '#ba92cf', cyan: '#6dc8c1', white: '#e5ebe7',
        brightBlack: '#58635d', brightRed: '#ff947b', brightGreen: '#a7deb9', brightYellow: '#f0d28a',
        brightBlue: '#92bce5', brightMagenta: '#d0a9df', brightCyan: '#8fddd6', brightWhite: '#ffffff',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalHostRef.current);
    fitAddon.fit();
    terminalRef.current = terminal;
    fitRef.current = fitAddon;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/terminal`);
    socketRef.current = socket;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'ready') {
        setRuntime(message.runtime);
        socket.send(JSON.stringify({ type: 'start', arch: 'riscv', mode: 'demo' }));
      } else if (message.type === 'output') terminal.write(message.data);
      else if (message.type === 'command-result') commitCommand(message.result.command, message.result);
      else if (message.type === 'status') setSession({ state: message.state, mode: message.mode, note: message.note || '' });
    });

    const inputDisposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: 'input', data }));
      for (const char of data) {
        if (char === '\r' || char === '\n') {
          if (sessionConfigRef.current.mode === 'real') commitCommand(commandBufferRef.current);
          commandBufferRef.current = '';
        } else if (char === '\u007f' || char === '\b') {
          commandBufferRef.current = commandBufferRef.current.slice(0, -1);
        } else if (char >= ' ') commandBufferRef.current += char;
      }
    });

    const resize = new ResizeObserver(() => fitAddon.fit());
    resize.observe(terminalHostRef.current);
    return () => {
      active = false;
      if (runtimeTimer) window.clearTimeout(runtimeTimer);
      inputDisposable.dispose();
      resize.disconnect();
      socket.close();
      terminal.dispose();
    };
  }, [commitCommand]);

  const restart = useCallback((next = {}) => {
    const config = { ...sessionConfigRef.current, ...next };
    sessionConfigRef.current = config;
    terminalRef.current?.reset();
    analysisRequestRef.current.controller?.abort();
    commandBufferRef.current = '';
    teachingStateRef.current = createInitialTeachingState();
    lastCommandRef.current = null;
    const initialTrace = traceCommand('ls /', INITIAL_TEACHING_STATE);
    setTrace(initialTrace);
    setSelectedId(initialTrace.nodes.find((item) => item.layer === 'vfs')?.id || initialTrace.nodes[0]?.id);
    setShowAi(false);
    setAiTask({
      state: aiEnabledRef.current ? 'armed' : 'idle',
      trace: null,
      note: aiEnabledRef.current ? '输入下一条命令后将在后台分析' : '',
    });
    if (socketRef.current?.readyState === WebSocket.OPEN)
      socketRef.current.send(JSON.stringify({ type: 'start', ...config }));
  }, []);

  const changeArch = (value) => {
    setArch(value);
    restart({ arch: value });
  };
  const changeMode = (value) => {
    setMode(value);
    restart({ mode: value });
  };
  const toggleAiAnalysis = () => {
    if (!aiEnabledRef.current && !aiRuntimeRef.current.available) return;
    analysisRequestRef.current.controller?.abort();
    const enabled = !aiEnabledRef.current;
    aiEnabledRef.current = enabled;
    setAiEnabled(enabled);
    setShowAi(false);
    const last = lastCommandRef.current;
    if (last) {
      setTrace(last.baseTrace);
      setSelectedId(last.baseTrace.nodes.find((item) => item.layer === 'vfs')?.id || last.baseTrace.nodes[0]?.id);
    }
    if (enabled && last) requestAiTrace(last.input, last.baseTrace);
    else setAiTask({
      state: enabled ? 'armed' : 'idle',
      trace: null,
      note: enabled ? '输入命令后将在后台分析' : '',
    });
  };
  const showAiTrace = () => {
    if (!aiTask.trace) return;
    setShowAi(true);
    setTrace(aiTask.trace);
    setSelectedId(aiTask.trace.nodes.find((item) => item.layer === 'vfs')?.id || aiTask.trace.nodes[0]?.id);
  };
  const showRuleTrace = () => {
    const ruleTrace = lastCommandRef.current?.baseTrace;
    if (!ruleTrace) return;
    setShowAi(false);
    setTrace(ruleTrace);
    setSelectedId(ruleTrace.nodes.find((item) => item.layer === 'vfs')?.id || ruleTrace.nodes[0]?.id);
  };
  const retryAiTrace = () => {
    const last = lastCommandRef.current;
    if (aiEnabledRef.current && last) requestAiTrace(last.input, last.baseTrace);
  };
  const stop = () => socketRef.current?.send(JSON.stringify({ type: 'stop' }));
  const runExample = async (commands) => {
    terminalRef.current?.focus();
    for (const command of commands.split('\n')) {
      for (const char of command) {
        socketRef.current?.send(JSON.stringify({ type: 'input', data: char }));
        commandBufferRef.current += char;
        await new Promise((resolve) => window.setTimeout(resolve, 18));
      }
      socketRef.current?.send(JSON.stringify({ type: 'input', data: '\r' }));
      if (sessionConfigRef.current.mode === 'real') commitCommand(commandBufferRef.current);
      commandBufferRef.current = '';
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <img src="/handsomeos-team-logo.png" alt="HandsoMeOS 队伍标志" />
          <div>
            <strong>HandsoMeOS</strong>
            <span>xv6 VFS + HAL 教学控制台</span>
          </div>
        </div>
        <div className="project-signals" aria-label="项目能力">
          <span><Layers3 size={14} /> xv6 · ext2 · FAT32</span>
          <span><Cpu size={14} /> 双架构</span>
          <span><Workflow size={14} /> 执行链追踪</span>
        </div>
        <div className="header-controls">
          <div className="arch-control" aria-label="处理器架构">
            <button className={arch === 'riscv' ? 'active' : ''} onClick={() => changeArch('riscv')}>RISC-V</button>
            <button className={arch === 'loongarch' ? 'active' : ''} onClick={() => changeArch('loongarch')}>LoongArch</button>
          </div>
          <span className="competition-mark"><Activity size={14} /> 2026 CSCC</span>
        </div>
      </header>

      <nav className="mobile-switch" aria-label="移动端视图">
        <button className={activeMobilePane === 'trace' ? 'active' : ''} onClick={() => setActiveMobilePane('trace')}><PanelLeft size={15} />执行链</button>
        <button className={activeMobilePane === 'terminal' ? 'active' : ''} onClick={() => setActiveMobilePane('terminal')}><TerminalSquare size={15} />终端</button>
      </nav>

      <section className="workspace">
        <section className={`trace-pane mobile-${activeMobilePane === 'trace' ? 'active' : 'hidden'}`}>
          <header className="pane-header">
            <div>
              <span className="pane-kicker"><GitCompareArrows size={14} /> COMMAND TRACE</span>
              <h1>命令执行链</h1>
            </div>
            <div className="trace-header-tools">
              <div className="analysis-actions" aria-label="AI 分析控制">
                <button
                  className={`ai-trigger ${aiEnabled ? 'active' : ''}`}
                  onClick={toggleAiAnalysis}
                  title={aiRuntime.available
                    ? `${aiEnabled ? '关闭' : '启动'} ${aiRuntime.model} 后台分析`
                    : aiRuntime.reason}
                  disabled={!aiRuntime.available && !aiEnabled}
                ><Sparkles size={11} />{aiTask.state === 'running' ? '停止 AI' : aiEnabled ? '关闭 AI' : '启动 AI'}</button>
                {aiTask.state === 'ready' && !showAi && (
                  <button className="ai-result" onClick={showAiTrace} title="显示已经完成的 AI 调用链">
                    <Eye size={11} />显示 AI 分析
                  </button>
                )}
                {showAi && (
                  <button className="ai-result" onClick={showRuleTrace} title="返回确定性规则调用链">
                    <RotateCcw size={11} />显示规则链
                  </button>
                )}
                {aiTask.state === 'error' && aiEnabled && (
                  <button className="ai-retry" onClick={retryAiTrace} title={aiTask.note}>
                    <RotateCcw size={11} />重试
                  </button>
                )}
              </div>
              <div className="trace-summary">
                <code>$ {trace.raw}</code>
                <span className={`trace-status status-${trace.status}`}>
                  {trace.status === 'success' ? '执行成功' : trace.status === 'error' ? '执行失败' : '实时推导'}
                  {' · '}{trace.nodes.length} 个节点 · {trace.backend}
                </span>
                <span
                  className={`trace-analysis analysis-${showAi ? 'ai' : aiTask.state === 'running' ? 'ai-loading' : aiTask.state === 'error' ? 'rule-fallback' : aiTask.state === 'ready' ? 'ai-ready' : 'rule'}`}
                  title={showAi ? trace.analysisNote : aiTask.note || trace.analysisNote}
                >
                  {showAi
                    ? <><ShieldCheck size={11} />AI 已通过源码校验</>
                    : aiTask.state === 'running'
                      ? <><Sparkles size={11} />规则链已展示 · AI 后台分析中</>
                      : aiTask.state === 'ready'
                        ? <><ShieldCheck size={11} />规则链已展示 · AI 结果已就绪</>
                        : aiTask.state === 'error'
                          ? <>规则链正常 · AI 分析失败</>
                          : aiTask.state === 'armed'
                            ? <>规则链正常 · AI 等待命令</>
                            : <>确定性规则链</>}
                </span>
              </div>
            </div>
          </header>
          <div className="layer-legend">
            {Object.entries(layerMeta).map(([key, item]) => <span key={key}><i className={`tone-${item.tone}`} />{item.label}</span>)}
          </div>
          <div className={selectedNode ? 'trace-canvas has-detail' : 'trace-canvas'}>
            <ReactFlowProvider>
              <TraceCanvas
                trace={trace}
                selectedId={selectedId}
                onSelect={setSelectedId}
                viewKey={activeMobilePane}
              />
            </ReactFlowProvider>
          </div>
          {selectedNode && <DetailPanel node={selectedNode} onClose={() => setSelectedId('')} />}
        </section>

        <section className={`terminal-pane mobile-${activeMobilePane === 'terminal' ? 'active' : 'hidden'}`}>
          <div className="terminal-intro">
            <div>
              <span className="pane-kicker"><ServerCog size={14} /> LIVE KERNEL LAB</span>
              <h2>交互式 xv6 会话</h2>
            </div>
            <p>输入命令后，左侧会同步显示用户态、系统调用、VFS、文件系统与 HAL 的真实源码路径。</p>
          </div>
          <TerminalPanel
            arch={arch}
            mode={mode}
            onModeChange={changeMode}
            runtime={runtime}
            session={session}
            terminalHostRef={terminalHostRef}
            onRestart={() => restart()}
            onStop={stop}
            onExample={runExample}
          />
          <div className="teaching-strip">
            <span><Braces size={15} /><strong>源码同步</strong>节点读取当前仓库</span>
            <span><HardDrive size={15} /><strong>挂载感知</strong>路径决定后端链路</span>
            <span><Code2 size={15} /><strong>参数释义</strong>地址、编号和指针逐项区分</span>
          </div>
        </section>
      </section>
    </main>
  );
}

export default App;
