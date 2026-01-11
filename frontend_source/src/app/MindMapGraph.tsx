'use client';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

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
    const d3Nodes = visibleData.map(d => ({ 
        ...d, 
        x: (d.x && d.x !== 0) ? d.x : dimensions.width / 2 + (Math.random() - 0.5) * 100, 
        y: (d.y && d.y !== 0) ? d.y : dimensions.height / 2 + (Math.random() - 0.5) * 100 
    }));
    
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
      .force("link", d3.forceLink(d3Links).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collide", d3.forceCollide().radius(50))
      .alphaMin(0.01); // Stops the simulation sooner so it doesn't "jitter"

    if (selectedNodeId) {
        simulation.alpha(0.1).restart(); // Use a low alpha so it doesn't explode outward
}

    const link = g.append("g").attr("stroke", "#555").selectAll("line").data(d3Links).join("line").attr("stroke-width", 2).attr("opacity", 0.6);

    const nodeGroup = g.append("g").selectAll("g").data(d3Nodes).join("g")
      .call(d3.drag()
          .on("start", (e, d: any) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on("drag", (e, d: any) => { d.fx = e.x; d.fy = e.y; })
          .on("end", (e, d: any) => { 
              if (!e.active) simulation.alphaTarget(0); 
              d.fx = null; d.fy = null;
              // PERSISTENCE: Save new position to DB
              fetch(`https://10.10.0.1/api/mindmap/node/${d.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: d.name, description: d.description, extraMeta: d.metadata, x: d.x, y: d.y })
              });
          }) as any
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
