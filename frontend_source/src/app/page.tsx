'use client';
import { useState, useEffect } from 'react';
import MindMapGraph from './MindMapGraph';

// --- TYPES ---
interface Node { id: number; name: string; description: string; metadata: any; }
interface Tab { id: string; title: string; type: 'graph' | 'node' | 'new'; nodeId?: number; }
interface Annotation { x: number; y: number; text: string; }

export default function Dashboard() {
  const [nodes, setNodes] = useState<Node[]>([]);
  
  // Layout
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [rightWidth, setRightWidth] = useState(400);
  
  // Tabs (Start with Graph)
  const [tabs, setTabs] = useState<Tab[]>([{ id: 'graph', title: 'Graph Overview', type: 'graph' }]);
  const [activeTabId, setActiveTabId] = useState('graph');
  
  // Graph State
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [filterType, setFilterType] = useState('all');
  
  // Editor State
  const [editForm, setEditForm] = useState<any>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  useEffect(() => { fetchNodes(); }, []);
  const fetchNodes = async () => {
    try {
      // FIX: Add timestamp (?t=...) and 'no-store' to force fresh data every time
      const res = await fetch(`https://10.10.0.1/api/mindmap?t=${Date.now()}`, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' } 
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("FRESH DATA RECEIVED:", data.find((n: any) => n.id === 1)); // Debug log
        setNodes(data);
      }
    } catch (e) { console.error(e); }
  };

  // --- ACTIONS ---

  // 1. Open New Tab (Browser Style)
  const openNewTab = () => {
    const newId = `new-${Date.now()}`;
    const newTab: Tab = { id: newId, title: 'New Page', type: 'new' };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
  };

  const closeTab = (e: any, id: string) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id && newTabs.length > 0) setActiveTabId(newTabs[newTabs.length - 1].id);
  };

  // 2. Open Node in Tab (from Graph Double Click or Inspect)
  const openNodeTab = (node: Node) => {
    const existing = tabs.find(t => t.nodeId === node.id);
    if (existing) {
      setActiveTabId(existing.id);
    } else {
      const newTab: Tab = { id: `node-${node.id}`, title: node.name, type: 'node', nodeId: node.id };
      setTabs([...tabs, newTab]);
      setActiveTabId(newTab.id);
    }
  };

  // 3. Create Node from Template
  const createFromTemplate = async (templateType: string) => {
    let initialDesc = "";
    if (templateType === 'medical') initialDesc = "## Symptoms\n\n## Diagnosis\n\n## Treatment\n";
    if (templateType === 'person') initialDesc = "## Bio\n\n## Relation\n\n## History\n";
    
    // Create placeholder node immediately to get an ID
    const customName = prompt("Enter Name:", "New " + templateType);
    if (!customName) return; // Stop if they hit cancel

    const payload = {
        name: customName, // Use the input name
        description: initialDesc,
        type: templateType,
        metadata: { parent: "", source: "template", type: templateType },
     // Add these to force the node to appear in the center of your view
        x: 400, 
        y: 300 
};
    
    // Save to DB
    const res = await fetch('https://10.10.0.1/api/mindmap/node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if(res.ok) {
        const newNode = await res.json();
        await fetchNodes(); // Refresh list
        // Open the tab for editing
        const newTab: Tab = { id: `node-${newNode.id}`, title: newNode.name, type: 'node', nodeId: newNode.id };
        // Replace current "New" tab with this node tab if active
        const updatedTabs = tabs.map(t => t.id === activeTabId ? newTab : t);
        setTabs(updatedTabs);
        setActiveTabId(newTab.id);
    }
  };

  // 4. Graph Interactions
  const handleNodeClick = (node: Node) => {
    setSelectedNode(node);
    const meta = typeof node.metadata === 'string' ? JSON.parse(node.metadata) : node.metadata || {};
    setAnnotations(meta.annotations || []);
    if (!rightPanelOpen) setRightPanelOpen(true);
  };

  // --- RENDER HELPERS ---
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Calculate Backlinks (Nodes that have THIS node as a parent)
  const backlinks = selectedNode ? nodes.filter(n => {
     const m = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata || {};
     return m.parent && m.parent.toLowerCase() === selectedNode.name.toLowerCase();
  }) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter, sans-serif', background: '#1e1e1e', color: '#ccc' }}>
      
      {/* 1. TOP TAB BAR */}
      <div style={{ display: 'flex', background: '#252526', borderBottom: '1px solid #000', alignItems: 'flex-end' }}>
        {tabs.map(tab => (
          <div 
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            style={{
              padding: '8px 15px', background: activeTabId === tab.id ? '#1e1e1e' : '#2d2d2d',
              borderRight: '1px solid #111', borderTop: activeTabId === tab.id ? '2px solid #0070f3' : '2px solid transparent',
              cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center', color: activeTabId === tab.id ? '#fff' : '#888',
              borderRadius: '5px 5px 0 0', marginRight: '2px'
            }}
          >
            {tab.title}
            {tab.id !== 'graph' && <span onClick={(e) => closeTab(e, tab.id)} style={{fontSize:'1.2rem', lineHeight:0.5}}>×</span>}
          </div>
        ))}
        {/* NEW TAB BUTTON */}
        <div onClick={openNewTab} style={{ padding: '8px 15px', cursor: 'pointer', color: '#888', fontSize: '1.2rem', background: '#2d2d2d', borderRadius: '5px 5px 0 0' }}>+</div>
      </div>

      {/* 2. MAIN WORKSPACE */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* CENTER PANEL */}
        <div style={{ flex: 1, position: 'relative', background: '#1e1e1e', display: 'flex', flexDirection: 'column' }}>
          
          {/* A. GRAPH VIEW */}
          {activeTab?.type === 'graph' && (
             <>
               <div style={{ padding: '10px', background: '#252526', borderBottom: '1px solid #333', display: 'flex', gap: '10px', alignItems: 'center' }}>
                 <span style={{fontWeight:'bold', color:'white'}}>Filters:</span>
                 {['all', 'person', 'medical', 'concept', 'location'].map(f => (
                    <button 
                        key={f} onClick={() => setFilterType(f)}
                        style={{ background: filterType === f ? '#0070f3' : '#333', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', textTransform:'capitalize' }}
                    >
                        {f}
                    </button>
                 ))}
               </div>
               <MindMapGraph 
                 data={nodes} 
                 onNodeClick={handleNodeClick} 
                 onNodeDoubleClick={openNodeTab} // Double Click opens tab
                 selectedNodeId={selectedNode?.id || null}
                 filterType={filterType}
               />
             </>
          )}

          {/* B. NEW PAGE (TEMPLATE SELECTION) */}
          {activeTab?.type === 'new' && (
             <div style={{ padding: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#eee' }}>
                <h1>What do you want to create?</h1>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '30px' }}>
                    <div onClick={() => createFromTemplate('person')} style={{ background: '#333', padding: '30px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: '1px solid #444' }}>
                        <h3>👤 Person</h3>
                        <p>Bio, Relationships, History</p>
                    </div>
                    <div onClick={() => createFromTemplate('medical')} style={{ background: '#333', padding: '30px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: '1px solid #444' }}>
                        <h3>🏥 Medical Model</h3>
                        <p>Anatomy, Symptoms, Notes</p>
                    </div>
                    <div onClick={() => createFromTemplate('concept')} style={{ background: '#333', padding: '30px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', border: '1px solid #444' }}>
                        <h3>💡 Concept</h3>
                        <p>Generic Idea or Note</p>
                    </div>
                </div>
             </div>
          )}

          {/* C. NODE TAB (FULL EDITOR) */}
          {activeTab?.type === 'node' && (
             <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Full screen Etherpad */}
                <iframe 
                  src={`/etherpad/p/node_${activeTab.nodeId}?showChat=true&showLineNumbers=true`}
                  style={{ flex: 1, width: '100%', border: 'none' }}
                />
             </div>
          )}
        </div>

{/* RIGHT PANEL (INSPECTOR) */}
        {rightPanelOpen ? (
          // --- 1. IF PANEL IS OPEN ---
          <div style={{ width: `${rightWidth}px`, background: '#252526', borderLeft: '1px solid #000', display: 'flex', flexDirection: 'column' }}>

            {/* Header with Close Button */}
            <div style={{ padding: '10px', background: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <span style={{ fontWeight: 'bold', color: 'white' }}>Inspector</span>
               <button onClick={() => setRightPanelOpen(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer' }}>Close »</button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
              {selectedNode ? (
                <>
                  <h2 style={{ marginTop: 0, color: 'white' }}>{selectedNode.name}</h2>
                  <button onClick={() => openNodeTab(selectedNode)} style={{ width: '100%', padding: '8px', marginBottom: '15px', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Open in New Tab
                  </button>

                  {/* BACKLINKS SECTION */}
                  <div style={{ marginBottom: '20px', background: '#111', padding: '10px', borderRadius: '8px' }}>
                     <h4 style={{ margin: '0 0 10px 0', color: '#aaa' }}>Linked Mentions (Backlinks)</h4>
                     {backlinks.length > 0 ? (
                        backlinks.map(bn => (
                            <div key={bn.id} onClick={() => handleNodeClick(bn)} style={{ padding: '5px', borderBottom: '1px solid #333', cursor: 'pointer', color: '#0070f3' }}>
                                ↳ {bn.name}
                            </div>
                        ))
                     ) : <div style={{fontStyle:'italic', color:'#666'}}>No nodes link here yet.</div>}
                  </div>

                  {/* QUICK NOTES (ETHERPAD) */}
                  <h4 style={{ margin: '0 0 10px 0' }}>Quick Notes</h4>
                  <iframe
                    src={`https://10.10.0.1/etherpad/p/node_${selectedNode.id}?showChat=false&showLineNumbers=false&showControls=false`}
                    style={{ width: '100%', height: '300px', border: '1px solid #444', borderRadius: '4px' }}
                  />
                </>
              ) : (
                <div style={{ color: '#666', textAlign: 'center', marginTop: '50px' }}>
                  Select a node to inspect.
                </div>
              )}
            </div>
          </div>
        ) : (
          // --- 2. IF PANEL IS CLOSED (THE MISSING PART) ---
          <div 
            onClick={() => setRightPanelOpen(true)}
            style={{ 
              width: '30px', background: '#333', borderLeft: '1px solid #555', cursor: 'pointer', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' 
            }}
            title="Open Inspector"
          >
            «
          </div>
        )}
      </div>
    </div>
  );
}
