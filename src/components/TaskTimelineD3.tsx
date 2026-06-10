import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Task } from '../types';

interface TaskTimelineD3Props {
  tasks: Task[];
  width?: number;
  onTaskClick?: (taskId: string) => void;
}

export default function TaskTimelineD3({ tasks, width = 800, onTaskClick }: TaskTimelineD3Props) {
  const d3Container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!d3Container.current || tasks.length === 0) return;

    // Clear previous drawing
    d3.select(d3Container.current).selectAll('svg').remove();
    d3.select(d3Container.current).selectAll('.d3-tooltip').remove();

    const validTasks = tasks.filter(t => t.createdAt && t.deadline).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (validTasks.length === 0) return;

    const margin = { top: 40, right: 30, bottom: 30, left: 160 };
    const rowHeight = 36;
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = validTasks.length * rowHeight;

    const svg = d3.select(d3Container.current)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${innerWidth + margin.left + margin.right} ${innerHeight + margin.top + margin.bottom}`)
      .attr('preserveAspectRatio', 'xMinYMin meet')
      .style('min-height', Math.max(300, innerHeight + margin.top + margin.bottom) + 'px')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Parse dates
    const parseDate = (d: string) => new Date(d);
    
    // Find min and max dates
    let minDate = d3.min(validTasks, d => parseDate(d.createdAt)) || new Date();
    let maxDate = d3.max(validTasks, d => parseDate(d.deadline)) || new Date();
    
    // Add some padding to dates (3 days each side)
    minDate = new Date(minDate.getTime() - 3 * 24 * 60 * 60 * 1000);
    maxDate = new Date(maxDate.getTime() + 3 * 24 * 60 * 60 * 1000);

    const x = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([0, innerWidth]);

    const y = d3.scaleBand()
      .domain(validTasks.map(d => d.id))
      .range([0, innerHeight])
      .padding(0.4);

    // Add Axes
    const xAxis = d3.axisTop(x)
      .ticks(6)
      .tickFormat(d3.timeFormat("%b %d") as any);
      
    const xAxisGroup = svg.append('g')
      .attr('class', 'x-axis')
      .call(xAxis);
      
    const styleXAxis = (g: any) => {
      g.selectAll('text')
        .style('fill', 'var(--app-text-muted)')
        .style('font-size', '11px')
        .style('font-weight', '500')
        .style('font-family', 'var(--font-sans)');
      g.selectAll('.domain').attr('stroke', 'transparent');
      g.selectAll('.tick line').attr('stroke', 'var(--app-border-strong)').attr('opacity', 0.5).attr('y2', innerHeight + margin.top);
    };
    
    styleXAxis(xAxisGroup);

    const yAxis = d3.axisLeft(y)
      .tickSizeOuter(0)
      .tickFormat(id => {
        const t = validTasks.find(t => t.id === id);
        let title = t?.title || id;
        if (title.length > 22) title = title.substring(0, 19) + '...';
        return title;
      });

    const yAxisGroup = svg.append('g')
      .attr('class', 'y-axis')
      .call(yAxis);
      
    yAxisGroup.selectAll('text')
      .style('fill', 'var(--app-text-strong)')
      .style('font-size', '12px')
      .style('font-family', 'var(--font-sans)');

    yAxisGroup.selectAll('.y-axis .domain, .y-axis .tick line').remove();

    // Setup definitions for arrows
    svg.append("defs").append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 8)
      .attr("refY", 5)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "var(--app-text-subtle)");

    // Draw dependency links
    const links: any[] = [];
    validTasks.forEach(t => {
      if (t.dependencies) {
        t.dependencies.forEach(depId => {
          const source = validTasks.find(v => v.id === depId); // source blocks target
          if (source) {
            links.push({ source: source, target: t });
          }
        });
      }
    });

    const lineGen = d3.line<{x: number, y: number}>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveStep);

    svg.selectAll('.dependency-line')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'dependency-line')
      .attr('d', (d: any) => {
        const startX = x(parseDate(d.source.deadline));
        const startY = y(d.source.id)! + y.bandwidth() / 2;
        const endX = x(parseDate(d.target.createdAt));
        const endY = y(d.target.id)! + y.bandwidth() / 2;
        
        // Create path points for elbow bend
        return lineGen([
            {x: startX, y: startY},
            {x: startX + 10, y: startY},
            {x: startX + 10, y: endY},
            {x: endX - 5, y: endY}
        ]);
      })
      .attr('fill', 'none')
      .attr('stroke', 'var(--app-text-subtle)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '2,4')
      .attr('marker-end', 'url(#arrow)')
      .style('cursor', 'pointer')
      .on('click', (event, d: any) => {
        if (onTaskClick) onTaskClick(d.target.id);
      });

    // Draw task bars
    const getStatusColor = (status: string) => {
      if (status === 'done') return '#10b981';
      if (status === 'in_progress') return '#3b82f6';
      if (status === 'review') return '#eab308';
      return '#64748b'; // todo or other
    }

    svg.selectAll('.task-bg-bar')
      .data(validTasks)
      .enter()
      .append('rect')
      .attr('class', 'task-bg-bar')
      .attr('x', 0)
      .attr('y', d => (y(d.id) || 0) - y.bandwidth()*0.2)
      .attr('width', innerWidth)
      .attr('height', y.bandwidth() * 1.4)
      .attr('fill', 'var(--app-surface-dim)')
      .attr('opacity', 0)
      .attr('rx', 4);

    svg.selectAll('.task-bar')
      .data(validTasks)
      .enter()
      .append('rect')
      .attr('class', 'task-bar')
      .attr('x', d => Math.max(0, x(parseDate(d.createdAt))))
      .attr('y', d => y(d.id) || 0)
      .attr('width', d => {
        const start = x(parseDate(d.createdAt));
        const end = x(parseDate(d.deadline));
        return Math.max(4, end - start);
      })
      .attr('height', y.bandwidth())
      .attr('fill', d => getStatusColor(d.status))
      .attr('rx', 4)
      .style('cursor', 'pointer');

    // Hover tooltips
    const tooltip = d3.select(d3Container.current)
      .append('div')
      .attr('class', 'd3-tooltip absolute hidden bg-surface border border-border-strong px-3 py-2 rounded text-xs text-strong shadow-xl pointer-events-none z-50 transition-opacity duration-150')
      .style('opacity', 0);

    svg.selectAll('.task-bar')
      .on('mouseover', function(event, d: any) {
        d3.select(this).attr('opacity', 0.8).attr('stroke', 'var(--app-text-strong)').attr('stroke-width', 1);
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`
          <div class="font-bold mb-1 border-b border-border-subtle pb-1">${d.title}</div>
          <div class="text-[10px] text-subtle mb-1">Status: <span class="capitalize text-strong">${d.status.replace('_', ' ')}</span></div>
          <div class="text-[10px] text-muted">Created: ${parseDate(d.createdAt).toLocaleDateString()}</div>
          <div class="text-[10px] text-muted">Deadline: <span class="text-strong">${parseDate(d.deadline).toLocaleDateString()}</span></div>
        `)
        .classed('hidden', false);
        
        // Highlight dependencies
        svg.selectAll('.dependency-line')
           .filter((l: any) => l.source.id === d.id || l.target.id === d.id)
           .attr('stroke', 'var(--app-text-strong)')
           .attr('stroke-width', 2)
           .attr('stroke-dasharray', null);
      })
      .on('mousemove', function(event: MouseEvent) {
        // Adjust for container offset if necessary, but event.pageX is page
        // Wait, d3Container might be positioned relative. The tooltip is appended to d3Container, so let's use DOM coordinates relative to the container.
        const [x, y] = d3.pointer(event, d3Container.current);
        tooltip.style('left', (x + 15) + 'px')
          .style('top', (y - 30) + 'px');
      })
      .on('mouseout', function(event, d: any) {
        d3.select(this).attr('opacity', 1).attr('stroke', 'none');
        tooltip.transition().duration(200).style('opacity', 0).on('end', function() {
          d3.select(this).classed('hidden', true);
        });
        
        // Reset dependency lines
        svg.selectAll('.dependency-line')
           .filter((l: any) => l.source.id === d.id || l.target.id === d.id)
           .attr('stroke', 'var(--app-text-subtle)')
           .attr('stroke-width', 1.5)
           .attr('stroke-dasharray', '2,4');
      })
      .on('click', (event, d: any) => {
        if (onTaskClick) onTaskClick(d.id);
      });

    // Semantic Zoom & Pan
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .on("zoom", (event) => {
        const t = event.transform;
        
        // Semantic zoom X
        const newX = t.rescaleX(x);
        
        // Update x-axis
        xAxisGroup.call(xAxis.scale(newX) as any);
        styleXAxis(xAxisGroup);

        // Pan Y (no zoom Y for the y-scale, just translation)
        yAxisGroup.attr("transform", `translate(0, ${t.y})`);

        // Update task bars (scale X, translate Y)
        svg.selectAll<SVGRectElement, any>('.task-bar')
          .attr('x', d => Math.max(0, newX(parseDate(d.createdAt))))
          .attr('y', d => (y(d.id) || 0) + t.y)
          .attr('width', d => {
              const start = newX(parseDate(d.createdAt));
              const end = newX(parseDate(d.deadline));
              return Math.max(4, end - start);
          });
          
        svg.selectAll<SVGRectElement, any>('.task-bg-bar')
          .attr('y', d => (y(d.id) || 0) - y.bandwidth()*0.2 + t.y);

        // Update links
        svg.selectAll<SVGPathElement, any>('.dependency-line')
          .attr('d', d => {
             const startX = newX(parseDate(d.source.deadline));
             const startY = y(d.source.id)! + y.bandwidth() / 2 + t.y;
             const endX = newX(parseDate(d.target.createdAt));
             const endY = y(d.target.id)! + y.bandwidth() / 2 + t.y;
             return lineGen([
                  {x: startX, y: startY},
                  {x: startX + 10, y: startY},
                  {x: startX + 10, y: endY},
                  {x: endX - 5, y: endY}
             ]);
          });
      });

    d3.select<SVGSVGElement, unknown>(d3Container.current!.querySelector('svg')!)
      .call(zoom);

  }, [tasks, width]);

  return (
    <div className="w-full overflow-x-auto relative rounded-lg border border-border-subtle bg-surface/50 min-h-[250px]" ref={d3Container}>
       {tasks.filter(t => t.createdAt && t.deadline).length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center text-sm text-subtle">
           No tasks with deadlines to display on timeline.
         </div>
       )}
    </div>
  );
}
