'use client';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { io } from 'socket.io-client'; // 1. Import Socket.io

const SOCKET_URL = 'https://10.10.0.1';

interface Node { id: number; name: string; metadata: any; type?: string; x?: number; y?: number; description?: string; }
interface GraphProps {
  data: Node[];
  onNodeClick: (node: Node) => void;
  onNodeDoubleClick: (node: Node) => void;
  selectedNodeId: number | null;
  filterType: string;
  searchTerm: string;
}

export default function MindMapGraph({ data, onNodeClick, onNodeDoubleClick, selectedNodeId, filterType, searchTerm }: GraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const socketRef = useRef<any>(null);

  useEffect(() => {
    socketRef.current = io(`${SOCKET_URL}/mindmap`, {
      path: '/mindmap-socket/socket.io/', 
      transports: ['websocket'], // Bypasses polling to avoid Mixed Content errors
      secure: true,
      reconnection: true
 });

    socketRef.current?.on('connect', () => {
      console.log('DEBUG: Is socket defined?', !!socketRef.current);
      console.log('✅ Mindmap Socket Connected with ID:', socketRef.current.id);
  });

    socketRef.current?.on('connect_error', (err) => {
      console.error('❌ Socket Connection Error:', err.message);
  });

    // Listen for other users moving nodes
    socketRef.current?.on('node_moved', (movedData: { id: number, x: number, y: number }) => {
      d3.select(`#node-group-${movedData.id}`)
        .attr("transform", `translate(${movedData.x},${movedData.y})`);
    });

    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) setDimensions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const visibleData = filterType === 'all' ? data : data.filter(d => {
        const meta = typeof d.metadata === 'string' ? JSON.parse(d.metadata) : d.metadata;
        return (meta?.type || 'person') === filterType;
    });

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    const g = svg.append("g");

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (e) => g.attr("transform", e.transform));

    svg.call(zoom as any).on("dblclick.zoom", null);

    // FIX: Properly initialize coordinates so they don't stack at 0,0
	console.log("RAW DATA FROM API:", data.find(n => n.id === 1));
    const d3Nodes = visibleData.map(d => { 
           const isZero = d.x === 0 && d.y === 0;
           const hasPosition = d.x !== null && d.x !== undefined && !isZero;

       return {
           ...d,
           // If it has a real position, use it. If it's 0,0 or null, center it.
           x: hasPosition ? d.x : dimensions.width / 2 + (Math.random() * 100 - 50), 
           y: hasPosition ? d.y : dimensions.height / 2 + (Math.random() * 100 - 50),

           // Only lock (fx/fy) if we actually have a saved position that isn't 0,0
           fx: hasPosition ? d.x : null,
           fy: hasPosition ? d.y : null
        };
    });
    
    const d3Links: any[] = [];
    d3Nodes.forEach(node => {
      let meta = node.metadata;
      if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
      if (meta?.parent) {
        const parent = d3Nodes.find(n => n.name.toLowerCase() === meta.parent.toLowerCase());
        if (parent) d3Links.push({ source: parent.id, target: node.id });
      }
    });

    const simulation = d3.forceSimulation(d3Nodes as any)
//      .force("link", d3.forceLink(d3Links).id((d: any) => d.id).distance(150))
//      .force("charge", d3.forceManyBody().strength(-400))
//      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
//      .force("collide", d3.forceCollide().radius(50))
  //    .alphaMin(0.01); // Stops the simulation sooner so it doesn't "jitter"

    if (selectedNodeId) {
//        simulation.alpha(0.1).restart(); // Use a low alpha so it doesn't explode outward
}

    const link = g.append("g").attr("stroke", "#555").selectAll("line").data(d3Links).join("line").attr("stroke-width", 2).attr("opacity", 0.6);


    const nodeGroup = g.append("g").selectAll("g").data(d3Nodes).join("g")
      .attr("id", (d: any) => `node-group-${d.id}`) // CRITICAL for WebSocket updates
      .call(d3.drag()
          .on("start", (e, d: any) => { 
              if (!e.active) simulation.alphaTarget(0.3).restart(); 
              d.fx = d.x; d.fy = d.y; 
          })
          .on("drag", (e, d: any) => { 
              d.fx = e.x; d.fy = e.y; 
              
              // 1. FAST LANE: Tell other users where we are moving
              // Use socketRef.current.emit to avoid the lag of the old fetch
              socketRef.current?.emit('node_move', { id: d.id, x: e.x, y: e.y });
          })
         .on("end", (e, d: any) => {
             if (!e.active) simulation.alphaTarget(0);

    // 1. Capture the mouse position immediately
             const finalX = e.x;
             const finalY = e.y;

    // 2. LOCK it so it stays there on screen
            d.fx = finalX;
            d.fy = finalY;

    // 3. Use the captured numbers for the socket
           console.log("Saving to DB:", d.id, finalX, finalY);
           socketRef.current?.emit('node_drag_end', {
               id: Number(d.id),
               x: finalX,
               y: finalY
    });

    console.log("Drag ended, position saved via WebSocket");
})     as any
      )
      .on("click", (e, d) => { e.stopPropagation(); onNodeClick(d as any); })
      .on("dblclick", (e, d) => { e.stopPropagation(); onNodeDoubleClick(d as any); })
      .style("cursor", "pointer");

    nodeGroup.append("circle")
      .attr("r", 30)
      .attr("fill", (d: any) => {
        if (d.id === selectedNodeId) return "#f1c40f";
        let meta = d.metadata;
        if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
        if (meta?.type === 'medical') return '#e74c3c';
        if (meta?.type === 'location') return '#2ecc71';
        if (meta?.type === 'concept') return '#9b59b6';
        return '#3498db';
      })
      .attr("stroke", (d: any) => d.id === selectedNodeId ? "#fff" : "#333")
      .attr("stroke-width", 2);

    nodeGroup.append("text").text(d => d.name).attr("x", 35).attr("y", 5).style("font-size", "14px").style("fill", "#ccc");

    simulation.on("tick", () => {
      link.attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y).attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      nodeGroup.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

  }, [data, dimensions, selectedNodeId, filterType]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#1e1e1e' }}>
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} style={{ display: 'block' }} />
    </div>
  );
}
