// prediction-ui/index.ts - Enhanced UI with Debug Visibility
import { TypedRheoCell } from "../protocols/example1/typed-mesh";

const PORT = 5100;
const cell = new TypedRheoCell(`Prediction_UI_${process.pid}`, 0);

const UI_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OPENJAWS // RADAR v3.1 - AI Absurdity Engine</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;600;700&display=swap');
        
        body { 
            background: #020202; 
            color: #00ffaa; 
            font-family: 'Fira Code', monospace; 
            overflow: hidden; 
            height: 100vh; 
            display: flex; 
            flex-direction: column; 
        }
        
        .scanline { 
            position: fixed; 
            inset: 0; 
            background: linear-gradient(to bottom, transparent 50%, rgba(0, 255, 170, 0.01) 50%); 
            background-size: 100% 4px; 
            pointer-events: none; 
            z-index: 100; 
        }
        
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #004d33; }
        
        .opportunity-card { 
            background: rgba(0, 255, 170, 0.02); 
            border: 1px solid #002b1d; 
            transition: 0.2s; 
        }
        .opportunity-card:hover { border-color: #00ffaa; background: rgba(0, 255, 170, 0.05); }
        
        .absurdity-extreme { border-color: #ff0040; background: rgba(255, 0, 64, 0.08); }
        .absurdity-extreme:hover { border-color: #ff0040; background: rgba(255, 0, 64, 0.12); }
        
        .absurdity-high { border-color: #ffaa00; background: rgba(255, 170, 0, 0.05); }
        .absurdity-high:hover { border-color: #ffaa00; background: rgba(255, 170, 0, 0.1); }
        
        .quick-win { 
            animation: pulse 2s infinite;
            box-shadow: 0 0 30px rgba(255, 0, 64, 0.4);
        }
        
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 20px rgba(255, 0, 64, 0.3); }
            50% { box-shadow: 0 0 40px rgba(255, 0, 64, 0.6); }
        }
        
        .tab-active { border-bottom: 2px solid #00ffaa; color: #00ffaa; }
        .tab-inactive { border-bottom: 2px solid transparent; color: #004d33; }
        .tab-inactive:hover { color: #00ffaa; }
        
        .score-ring {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            border: 3px solid;
        }
        
        .score-extreme { border-color: #ff0040; color: #ff0040; }
        .score-high { border-color: #ffaa00; color: #ffaa00; }
        .score-medium { border-color: #00ffaa; color: #00ffaa; }
        
        .action-buy-no { color: #00ff00; font-weight: bold; }
        .action-buy-yes { color: #ff0040; font-weight: bold; }
        .action-avoid { color: #888; }
        
        .risk-tag {
            font-size: 9px;
            padding: 2px 6px;
            background: rgba(255, 0, 0, 0.1);
            border: 1px solid rgba(255, 0, 0, 0.3);
            color: #ff6666;
            border-radius: 4px;
        }
        
        .gotcha-box {
            background: rgba(255, 170, 0, 0.05);
            border-left: 3px solid #ffaa00;
            padding: 8px;
            margin-top: 8px;
        }
        
        .cached-badge {
            display: inline-block;
            font-size: 8px;
            padding: 2px 6px;
            background: rgba(0, 255, 170, 0.1);
            border: 1px solid #00ffaa;
            color: #00ffaa;
            border-radius: 3px;
            margin-left: 8px;
        }
        
        .debug-panel {
            position: fixed;
            bottom: 0;
            right: 0;
            width: 400px;
            max-height: 300px;
            background: rgba(0, 0, 0, 0.95);
            border: 1px solid #00ffaa;
            border-bottom: none;
            border-right: none;
            overflow-y: auto;
            font-size: 9px;
            padding: 8px;
            z-index: 1000;
        }
        
        .debug-panel::-webkit-scrollbar { width: 4px; }
        .debug-panel::-webkit-scrollbar-thumb { background: #00ffaa; }
        
        .log-entry { margin-bottom: 4px; opacity: 0.8; }
        .log-error { color: #ff0040; }
        .log-success { color: #00ff00; }
        .log-info { color: #00ffaa; }
    </style>
</head>
<body class="p-4 md:p-6">
    <div class="scanline"></div>
    
    <header class="flex-none mb-4 border-b border-emerald-900 pb-4 flex justify-between items-center">
        <div>
            <h1 class="text-xl font-bold tracking-widest uppercase">RADAR_TERMINAL <span class="opacity-50 text-xs">v3.1 - AI ABSURDITY ENGINE</span></h1>
            <div id="status" class="text-[9px] text-emerald-500 mt-1">[ INITIALIZING ]</div>
        </div>
        <div class="flex gap-4 text-[10px]">
            <div class="text-center">
                <div class="text-red-400 font-bold text-lg" id="quick-win-count">-</div>
                <div class="opacity-50">QUICK WINS</div>
            </div>
            <div class="text-center">
                <div class="text-emerald-400 font-bold text-lg" id="opportunity-count">-</div>
                <div class="opacity-50">OPPORTUNITIES</div>
            </div>
            <div class="text-center">
                <div class="text-emerald-400 font-bold text-lg" id="cache-age">-</div>
                <div class="opacity-50">CACHE AGE</div>
            </div>
        </div>
    </header>

    <!-- Tabs -->
    <div class="flex-none flex gap-6 mb-4 text-[11px] font-bold uppercase tracking-wider">
        <button onclick="switchTab('cached')" id="tab-cached" class="tab-active pb-2 transition-colors">
            ⚡ Cached (Instant)
        </button>
        <button onclick="switchTab('deep')" id="tab-deep" class="tab-inactive pb-2 transition-colors">
            🔍 Deep AI Scan
        </button>
        <button onclick="switchTab('quick')" id="tab-quick" class="tab-inactive pb-2 transition-colors">
            🎯 Quick Wins
        </button>
        <button onclick="switchTab('debug')" id="tab-debug" class="tab-inactive pb-2 transition-colors">
            🐛 Debug API
        </button>
    </div>

    <!-- Filters -->
    <div class="flex-none flex gap-4 mb-4 text-[10px] items-center flex-wrap">
        <label class="flex items-center gap-2">
            <span class="opacity-50">Min Volume:</span>
            <select id="volume-filter" onchange="refreshData()" class="bg-black border border-emerald-900 text-emerald-400 px-2 py-1">
                <option value="0">All</option>
                <option value="1000">$1k+</option>
                <option value="5000">$5k+</option>
                <option value="10000" selected>$10k+</option>
                <option value="50000">$50k+</option>
                <option value="100000">$100k+</option>
            </select>
        </label>
        <label class="flex items-center gap-2">
            <span class="opacity-50">Absurdity:</span>
            <select id="absurdity-filter" onchange="refreshData()" class="bg-black border border-emerald-900 text-emerald-400 px-2 py-1">
                <option value="0">All</option>
                <option value="20">20+</option>
                <option value="40" selected>40+</option>
                <option value="60">60+ (High)</option>
                <option value="80">80+ (Extreme)</option>
            </select>
        </label>
        <button onclick="forceDeepScan()" class="bg-emerald-900/30 border border-emerald-700 px-3 py-1 hover:bg-emerald-900/50 transition-colors">
            🔄 Force Deep Scan
        </button>
        <button onclick="showCacheStats()" class="bg-blue-900/30 border border-blue-700 px-3 py-1 hover:bg-blue-900/50 transition-colors">
            📊 Cache Stats
        </button>
        <button onclick="toggleDebugPanel()" class="bg-yellow-900/30 border border-yellow-700 px-3 py-1 hover:bg-yellow-900/50 transition-colors">
            🐛 Toggle Debug
        </button>
    </div>

    <div class="flex-1 overflow-y-auto custom-scroll" id="main-content">
        <div class="flex items-center justify-center h-full text-emerald-600 text-[10px]">
            Initializing...
        </div>
    </div>

    <!-- Debug Panel -->
    <div id="debug-panel" class="debug-panel" style="display: none;">
        <div class="flex justify-between items-center mb-2 pb-2 border-b border-emerald-900">
            <span class="font-bold text-emerald-400">DEBUG LOG</span>
            <button onclick="clearDebugLog()" class="text-red-400 hover:text-red-300">CLEAR</button>
        </div>
        <div id="debug-log"></div>
    </div>

    <script>
        let currentTab = 'cached';
        let isScanning = false;
        let debugLogs = [];
        
        function log(message, type = 'info') {
            const timestamp = new Date().toLocaleTimeString();
            const logClass = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : 'log-info';
            debugLogs.push({ timestamp, message, type });
            
            const debugLog = document.getElementById('debug-log');
            if (debugLog) {
                const entry = document.createElement('div');
                entry.className = 'log-entry ' + logClass;
                entry.textContent = '[' + timestamp + '] ' + message;
                debugLog.appendChild(entry);
                debugLog.scrollTop = debugLog.scrollHeight;
                
                // Keep only last 100 entries
                if (debugLogs.length > 100) {
                    debugLogs.shift();
                    debugLog.removeChild(debugLog.firstChild);
                }
            }
            console.log('[' + type.toUpperCase() + '] ' + message);
        }
        
        function toggleDebugPanel() {
            const panel = document.getElementById('debug-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
        
        function clearDebugLog() {
            debugLogs = [];
            document.getElementById('debug-log').innerHTML = '';
        }
        
        function switchTab(tab) {
            log('Switching to tab: ' + tab);
            currentTab = tab;
            document.querySelectorAll('[id^="tab-"]').forEach(el => {
                el.classList.remove('tab-active');
                el.classList.add('tab-inactive');
            });
            document.getElementById('tab-' + tab).classList.remove('tab-inactive');
            document.getElementById('tab-' + tab).classList.add('tab-active');
            refreshData();
        }
        
        async function loadCachedOpportunities() {
            const container = document.getElementById('main-content');
            log('Loading cached opportunities...');
            container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-emerald-600 text-[10px] space-y-2"><div>⚡ Loading cached analyses...</div></div>';
            document.getElementById('status').innerText = '[ LOADING_CACHE ]';
            
            try {
                const minVolume = parseInt(document.getElementById('volume-filter').value);
                const minAbsurdity = parseInt(document.getElementById('absurdity-filter').value);
                
                log('Fetching /api/cached?minVolume=' + minVolume + '&minAbsurdity=' + minAbsurdity);
                const res = await fetch("/api/cached?minVolume=" + minVolume + "&minAbsurdity=" + minAbsurdity);
                
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status + ': ' + res.statusText);
                }
                
                const data = await res.json();
                log('Received ' + (data.opportunities?.length || 0) + ' opportunities', 'success');
                
                if (!data.opportunities || data.opportunities.length === 0) {
                    container.innerHTML = '<div class="flex flex-col items-center justify-center h-full text-emerald-800 text-[10px] space-y-2"><div>No cached analyses match your filters.</div><div class="opacity-50">Cache has ' + (data.total || 0) + ' total analyses</div><div class="opacity-50">Try lowering absurdity threshold or run a deep scan.</div></div>';
                    document.getElementById('status').innerText = '[ NO_CACHED_RESULTS ]';
                    log('No results matching filters (total in cache: ' + (data.total || 0) + ')', 'info');
                    return;
                }
                
                updateStats({
                    quickWins: data.opportunities.filter(o => o.isQuickWin).length,
                    opportunities: data.opportunities,
                    scanTimeMs: 0
                });
                
                // Calculate cache age
                if (data.newestAnalysis && data.newestAnalysis !== 'None') {
                    const newest = new Date(data.newestAnalysis);
                    const ageMinutes = Math.floor((Date.now() - newest.getTime()) / 60000);
                    const ageDisplay = ageMinutes < 60 ? ageMinutes + 'm' : Math.floor(ageMinutes / 60) + 'h';
                    document.getElementById('cache-age').innerText = ageDisplay;
                    log('Cache age: ' + ageDisplay);
                } else {
                    document.getElementById('cache-age').innerText = 'N/A';
                }
                
                renderOpportunities(data.opportunities);
                document.getElementById('status').innerText = '[ CACHED_' + data.total + '_ANALYSES ]';
            } catch (e) {
                log('Failed to load cache: ' + e.message, 'error');
                container.innerHTML = '<div class="text-red-400 text-[10px] p-4">Failed to load cache: ' + e.message + '<br><br>Check console for details.</div>';
                document.getElementById('status').innerText = '[ CACHE_ERROR ]';
            }
        }
        
        async function forceDeepScan() {
            if (isScanning) {
                log('Scan already in progress', 'error');
                return;
            }
            isScanning = true;
            log('Starting deep scan...');
            document.getElementById('status').innerText = '[ AI_ANALYZING_MARKETS... ]';
            document.getElementById('main-content').innerHTML = '<div class="flex flex-col items-center justify-center h-full text-emerald-600 text-[10px] space-y-2"><div>🤖 AI is analyzing high-volume prediction markets...</div><div class="opacity-50">This may take 30-90 seconds</div><div class="opacity-50">Processing in batches of 10 markets</div><div class="opacity-50" id="scan-progress">Starting...</div></div>';
            
            try {
                const minVolume = parseInt(document.getElementById('volume-filter').value);
                const minAbsurdity = parseInt(document.getElementById('absurdity-filter').value);
                
                log('Fetching /api/deep-scan?minVolume=' + minVolume + '&minAbsurdity=' + minAbsurdity);
                const res = await fetch("/api/deep-scan?minVolume=" + minVolume + "&minAbsurdity=" + minAbsurdity);
                
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status + ': ' + res.statusText);
                }
                
                const data = await res.json();
                log('Deep scan complete: ' + data.analyzed + ' analyzed (' + data.fromCache + ' cached, ' + data.newlyAnalyzed + ' new)', 'success');
                
                updateStats(data);
                renderOpportunities(data.opportunities);
                
                document.getElementById('status').innerText = '[ SCAN_COMPLETE: ' + data.newlyAnalyzed + '_NEW ]';
            } catch (e) {
                log('Deep scan failed: ' + e.message, 'error');
                document.getElementById('main-content').innerHTML = '<div class="text-red-400 text-[10px] p-4">Scan failed: ' + e.message + '<br><br>Check console for details.</div>';
                document.getElementById('status').innerText = '[ SCAN_FAILED ]';
            } finally {
                isScanning = false;
            }
        }
        
        async function showCacheStats() {
            log('Fetching cache stats...');
            try {
                const res = await fetch('/api/cache-stats');
                
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status + ': ' + res.statusText);
                }
                
                const stats = await res.json();
                log('Cache stats loaded: ' + stats.totalAnalyzed + ' analyses', 'success');
                
                let oldest = 'None';
                let newest = 'None';
                let ageRange = 'N/A';
                
                if (stats.oldestAnalysis !== 'None' && stats.newestAnalysis !== 'None') {
                    oldest = new Date(stats.oldestAnalysis).toLocaleString();
                    newest = new Date(stats.newestAnalysis).toLocaleString();
                    const ageHours = Math.floor((new Date(stats.newestAnalysis) - new Date(stats.oldestAnalysis)) / 3600000);
                    ageRange = ageHours + 'h';
                }
                
                alert(
                    'CACHE STATISTICS\\n' +
                    '================\\n\\n' +
                    'Total Analyzed: ' + stats.totalAnalyzed + '\\n' +
                    'Total Seen: ' + stats.totalSeen + '\\n' +
                    'Cache Size: ' + stats.cacheSize + '\\n' +
                    'Age Range: ' + ageRange + '\\n' +
                    'Oldest: ' + oldest + '\\n' +
                    'Newest: ' + newest
                );
            } catch (e) {
                log('Failed to load cache stats: ' + e.message, 'error');
                alert('Failed to load cache stats: ' + e.message);
            }
        }
        
        async function debugMarkets() {
            const container = document.getElementById('main-content');
            log('Loading API debug info...');
            container.innerHTML = '<div class="flex items-center justify-center h-full text-yellow-600 text-[10px]">Checking API data...</div>';
            
            try {
                const res = await fetch('/api/debug-markets?limit=20&sortBy=volume');
                
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status + ': ' + res.statusText);
                }
                
                const data = await res.json();
                log('Debug data loaded: ' + data.count + ' markets', 'success');
                
                container.innerHTML = \`
                <div class="p-4 space-y-4">
                    <div class="bg-yellow-900/20 border border-yellow-700 p-3">
                        <div class="font-bold text-yellow-400 mb-2">API DEBUG INFO</div>
                        <div class="text-[10px] text-yellow-300 space-y-1">
                            <div>Total Markets Received: \${data.count}</div>
                            <div>Volume Stats:</div>
                            <div class="ml-4">Min: $\${data.volumeStats.min.toFixed(0)}</div>
                            <div class="ml-4">Max: $\${data.volumeStats.max.toFixed(0)}</div>
                            <div class="ml-4">Avg: $\${data.volumeStats.avg.toFixed(0)}</div>
                            <div class="ml-4">Total: $\${(data.volumeStats.total / 1000000).toFixed(1)}M</div>
                        </div>
                    </div>
                    
                    <div class="text-[11px] font-bold text-yellow-400">SAMPLE MARKETS:</div>
                    
                    \${data.markets.map(m => \`
                        <div class="bg-black/30 border border-yellow-900/30 p-3">
                            <div class="text-white font-bold text-[10px] mb-1">\${m.title}</div>
                            <div class="text-[9px] text-yellow-300">
                                <div>ID: \${m.id}</div>
                                <div>Volume: $\${m.volume.toFixed(0)} (raw: \${m.volumeRaw})</div>
                                <div>Markets: \${m.markets}</div>
                                <div>End: \${m.endDate || 'Unknown'}</div>
                            </div>
                        </div>
                    \`).join('')}
                </div>
                \`;
            } catch (e) {
                log('Debug markets failed: ' + e.message, 'error');
                container.innerHTML = '<div class="text-red-400 text-[10px] p-4">Debug failed: ' + e.message + '</div>';
            }
        }
        
        function updateStats(data) {
            const quickWins = data.quickWins || 0;
            const opportunities = data.opportunities?.length || 0;
            
            document.getElementById('quick-win-count').innerText = quickWins;
            document.getElementById('opportunity-count').innerText = opportunities;
            
            log('Updated stats: ' + opportunities + ' opportunities, ' + quickWins + ' quick wins');
        }
        
        function renderOpportunities(opportunities) {
            const container = document.getElementById('main-content');
            
            if (!opportunities || opportunities.length === 0) {
                container.innerHTML = '<div class="flex items-center justify-center h-full text-emerald-800 text-[10px]">No absurd opportunities found with current filters.</div>';
                return;
            }
            
            log('Rendering ' + opportunities.length + ' opportunities');
            
            container.innerHTML = opportunities.map(opp => {
                const isQuick = opp.isQuickWin;
                const absurdityClass = opp.absurdityScore >= 80 ? 'absurdity-extreme' : 
                                      opp.absurdityScore >= 50 ? 'absurdity-high' : 'opportunity-card';
                const scoreClass = opp.absurdityScore >= 80 ? 'score-extreme' : 
                                  opp.absurdityScore >= 50 ? 'score-high' : 'score-medium';
                const actionClass = opp.recommendedAction === 'BUY_NO' ? 'action-buy-no' : 
                                   opp.recommendedAction === 'BUY_YES' ? 'action-buy-yes' : 'action-avoid';
                
                let ageDisplay = '';
                if (opp.analyzedAt) {
                    const ageMinutes = Math.floor((Date.now() - opp.analyzedAt) / 60000);
                    ageDisplay = ageMinutes < 60 ? 
                        ageMinutes + 'm ago' : 
                        ageMinutes < 1440 ?
                        Math.floor(ageMinutes / 60) + 'h ago' :
                        Math.floor(ageMinutes / 1440) + 'd ago';
                }
                
                return \`
                <div class="\${absurdityClass} p-4 mb-4 \${isQuick ? 'quick-win' : ''}">
                    <div class="flex justify-between items-start mb-3">
                        <div class="flex-1 pr-4">
                            <div class="flex items-center gap-2 mb-1 flex-wrap">
                                \${isQuick ? '<span class="text-[9px] text-red-400 font-bold border border-red-400 px-2 py-0.5">⚡ QUICK WIN</span>' : ''}
                                \${opp.isCached && ageDisplay ? '<span class="cached-badge">⚡ CACHED ' + ageDisplay + '</span>' : ''}
                                <span class="text-[9px] opacity-50">ID: \${opp.id}</span>
                            </div>
                            <h3 class="text-sm font-bold text-white uppercase leading-tight mb-1">\${opp.title}</h3>
                            <div class="text-[9px] opacity-50">
                                Volume: $\${(opp.volume / 1000).toFixed(0)}k | 
                                Odds: \${(opp.odds.yes * 100).toFixed(1)}% Yes / \${(opp.odds.no * 100).toFixed(1)}% No
                                \${opp.marketUrl ? '| <a href="' + opp.marketUrl + '" target="_blank" class="text-emerald-400 hover:underline">View Market →</a>' : ''}
                            </div>
                        </div>
                        <div class="flex flex-col items-center gap-2">
                            <div class="score-ring \${scoreClass}">
                                \${opp.absurdityScore}
                            </div>
                            <div class="text-[8px] opacity-50">ABSURDITY</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-3 text-[10px]">
                        <div class="bg-black/30 p-3">
                            <div class="opacity-50 mb-1 text-[9px] uppercase">What Needs To Happen</div>
                            <div class="text-emerald-300 leading-relaxed">\${opp.whatNeedsToHappen}</div>
                        </div>
                        <div class="bg-black/30 p-3">
                            <div class="opacity-50 mb-1 text-[9px] uppercase">Base Rate Assessment</div>
                            <div class="text-emerald-300 leading-relaxed">\${opp.baseRateAssessment}</div>
                        </div>
                    </div>

                    \${opp.hiddenGotchas && opp.hiddenGotchas.length > 0 ? \`
                        <div class="gotcha-box mb-3">
                            <div class="text-[9px] text-orange-400 font-bold mb-1">⚠️ HIDDEN GOTCHAS</div>
                            <ul class="text-[9px] text-orange-300 space-y-1 list-disc list-inside">
                                \${opp.hiddenGotchas.map(g => '<li>' + g + '</li>').join('')}
                            </ul>
                        </div>
                    \` : ''}

                    <div class="flex justify-between items-center pt-3 border-t border-emerald-900/30">
                        <div class="flex items-center gap-4 flex-wrap">
                            <div>
                                <span class="opacity-50 text-[9px]">ACTION:</span>
                                <span class="\${actionClass} text-[11px] ml-1">\${opp.recommendedAction.replace('_', ' ')}</span>
                            </div>
                            <div>
                                <span class="opacity-50 text-[9px]">PROFIT:</span>
                                <span class="text-green-400 text-[11px] ml-1 font-bold">+\${opp.expectedReturn.toFixed(1)}%</span>
                            </div>
                            <div>
                                <span class="opacity-50 text-[9px]">CONFIDENCE:</span>
                                <span class="text-emerald-400 text-[11px] ml-1">\${opp.confidenceScore}%</span>
                            </div>
                        </div>
                    </div>

                    \${opp.keyRisks && opp.keyRisks.length > 0 ? \`
                        <div class="mt-3 flex flex-wrap gap-2">
                            \${opp.keyRisks.map(risk => '<span class="risk-tag">' + risk + '</span>').join('')}
                        </div>
                    \` : ''}
                </div>
                \`;
            }).join('');
        }
        
        async function refreshData() {
            if (currentTab === 'cached') {
                await loadCachedOpportunities();
            } else if (currentTab === 'deep') {
                await forceDeepScan();
            } else if (currentTab === 'quick') {
                await loadQuickWins();
            } else if (currentTab === 'debug') {
                await debugMarkets();
            }
        }
        
        async function loadQuickWins() {
            const container = document.getElementById('main-content');
            log('Loading quick wins from cache...');
            container.innerHTML = '<div class="flex items-center justify-center h-full text-emerald-600 text-[10px]">Loading quick wins from cache...</div>';
            
            try {
                const res = await fetch('/api/cached?minAbsurdity=70&minVolume=0');
                
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status + ': ' + res.statusText);
                }
                
                const data = await res.json();
                
                const quickWins = data.opportunities.filter(o => o.isQuickWin);
                log('Found ' + quickWins.length + ' quick wins', 'success');
                
                if (quickWins.length === 0) {
                    container.innerHTML = '<div class="flex items-center justify-center h-full text-emerald-800 text-[10px]">No quick wins found in cache. Run a deep scan to find opportunities.</div>';
                    return;
                }
                
                updateStats({ ...data, opportunities: quickWins, quickWins: quickWins.length });
                renderOpportunities(quickWins);
            } catch (e) {
                log('Failed to load quick wins: ' + e.message, 'error');
                container.innerHTML = '<div class="text-red-400 text-[10px]">Error loading quick wins: ' + e.message + '</div>';
            }
        }
        
        // Initialize with cached data
        log('Page loaded, initializing...');
        setTimeout(() => {
            log('Starting initial data load');
            loadCachedOpportunities();
        }, 100);
    </script>
</body>
</html>
`;

Bun.serve({
    port: PORT,
    hostname: "0.0.0.0",
    idleTimeout: 120,
    async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname === "/") return new Response(UI_HTML, { headers: { "Content-Type": "text/html" } });

        try {
            if (url.pathname === "/api/cached") {
                const minVolume = parseInt(url.searchParams.get("minVolume") || "10000");
                const minAbsurdity = parseInt(url.searchParams.get("minAbsurdity") || "40");
                const limit = parseInt(url.searchParams.get("limit") || "100");

                cell.log("INFO", `📥 UI requesting cached opportunities (minVol=$${minVolume}, minAbs=${minAbsurdity})`);

                const data = await cell.mesh.analyst.getCachedOpportunities({
                    minVolume,
                    minAbsurdity,
                    limit
                });

                cell.log("INFO", `📤 Returning ${data.opportunities.length} cached opportunities`);
                return Response.json(data);
            }

            if (url.pathname === "/api/deep-scan") {
                const minVolume = parseInt(url.searchParams.get("minVolume") || "10000");
                const minAbsurdity = parseInt(url.searchParams.get("minAbsurdity") || "40");
                const maxMarkets = parseInt(url.searchParams.get("maxMarkets") || "100");

                cell.log("INFO", `🔍 UI requesting deep scan (minVol=$${minVolume}, minAbs=${minAbsurdity}, max=${maxMarkets})`);

                const data = await cell.mesh.analyst.deepScan({
                    minVolume,
                    minAbsurdity,
                    maxMarkets
                });

                cell.log("INFO", `📤 Deep scan complete: ${data.opportunities.length} opportunities found`);
                return Response.json(data);
            }

            if (url.pathname === "/api/cache-stats") {
                cell.log("INFO", `📊 UI requesting cache stats`);
                const data = await cell.mesh.analyst.getCacheStats({});
                cell.log("INFO", `📤 Returning cache stats: ${data.totalAnalyzed} analyses`);
                return Response.json(data);
            }

            if (url.pathname === "/api/debug-markets") {
                const limit = parseInt(url.searchParams.get("limit") || "20");
                const sortBy = url.searchParams.get("sortBy") || "volume";

                cell.log("INFO", `🐛 UI requesting debug markets (limit=${limit}, sortBy=${sortBy})`);
                const data = await cell.mesh.analyst.debugMarkets({ limit, sortBy: sortBy as any });
                cell.log("INFO", `📤 Returning ${data.markets.length} debug markets`);
                return Response.json(data);
            }

            if (url.pathname === "/api/analyze") {
                const eventId = url.searchParams.get("id");
                if (!eventId) return Response.json({ error: "Missing id" }, { status: 400 });

                cell.log("INFO", `🔍 UI requesting analysis for market ${eventId}`);
                const data = await cell.mesh.analyst.analyzeOne({ eventId });
                return Response.json(data);
            }
        } catch (e) {
            cell.log("ERROR", `❌ API error on ${url.pathname}: ${e.message}`);
            return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
        }
        return new Response("Not Found", { status: 404 });
    }
});

cell.listen();
cell.log("INFO", "🎯 Prediction UI v3.1 online with Debug Panel at http://localhost:" + PORT);