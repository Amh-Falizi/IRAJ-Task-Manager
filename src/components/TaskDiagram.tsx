import React, { useMemo, useCallback, useRef } from 'react';
import { 
  ReactFlow, MiniMap, Controls, Background, useNodesState, useEdgesState, MarkerType, 
  Connection, addEdge, ReactFlowProvider, useReactFlow, Handle, Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Task } from '../types';

interface TaskDiagramProps {
  tasks: Task[];
  layoutKey?: string;
  onConnectTask?: (sourceId: string, targetId: string) => void;
  onReverseConnection?: (sourceId: string, targetId: string) => void;
  onRemoveConnection?: (sourceId: string, targetId: string) => void;
  onTaskDoubleClick?: (taskId: string) => void;
}

const nodeWidth = 220;
const nodeHeight = 90;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranker: 'network-simplex', nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    // For stable layout, enforce a consistent topological direction for the layout engine
    // regardless of actual dependency direction. This prevents nodes from violently 
    // swapping places when a user reverses a connection.
    const layoutSource = edge.source < edge.target ? edge.source : edge.target;
    const layoutTarget = edge.source < edge.target ? edge.target : edge.source;
    dagreGraph.setEdge(layoutSource, layoutTarget);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    // Determine the layout constraints depending on the direction
    const isHorizontal = direction === 'LR';
    node.targetPosition = isHorizontal ? 'left' : 'top';
    node.sourcePosition = isHorizontal ? 'right' : 'bottom';

    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

// Custom Node Component to have handles visible
const CustomTaskNode = ({ data, isConnectable, targetPosition, sourcePosition }: any) => {
  return (
    <div 
      className="border rounded flex flex-col items-start p-3 h-full shadow-sm"
      style={{ 
        width: nodeWidth,
        maxWidth: nodeWidth,
        backgroundColor: data.bgColor, 
        borderColor: data.borderColor,
        color: data.textColor
      }}
    >
      <Handle 
        type="target" 
        position={targetPosition} 
        isConnectable={isConnectable} 
        id="target" 
        className="w-2 h-2 !bg-blue-400 !border-2 !border-surface"
      />
      <div className="w-full h-full flex flex-col justify-center">
        <div className="text-xs font-bold truncate w-full">{data.task.title}</div>
        <div className="text-[9px] uppercase tracking-wider mt-1 opacity-70 font-bold truncate w-full">
          STATUS: {data.task.status.replace('_', ' ')}
        </div>
      </div>
      <Handle 
        type="source" 
        position={sourcePosition} 
        isConnectable={isConnectable} 
        id="source" 
        className="w-2 h-2 !bg-blue-400 !border-2 !border-surface"
      />
    </div>
  );
};

const nodeTypes = {
  customTaskNode: CustomTaskNode
};

function FlowLogic({ tasks, layoutKey, onConnectTask, onReverseConnection, onRemoveConnection, onTaskDoubleClick }: TaskDiagramProps) {
  const { getIntersectingNodes } = useReactFlow();
  
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    
    const nodes = tasks.map((task) => {
      let bgColor = task.status === 'done' ? 'var(--app-bg)' : 'var(--app-surface)';
      let textColor = 'var(--app-text-strong)';
      
      const borderColor = task.status === 'done' ? '#10b981' : task.status === 'in_progress' ? '#3b82f6' : task.status === 'review' ? '#eab308' : 'var(--app-border-strong)';

      return {
        id: task.id,
        type: 'customTaskNode',
        data: {
          task,
          bgColor,
          borderColor,
          textColor
        },
        position: { x: 0, y: 0 },
      };
    });

    const edges: any[] = [];
    tasks.forEach(task => {
      if (task.dependencies) {
        task.dependencies.forEach(depId => {
          const sourceTask = tasks.find(t => t.id === depId);
          edges.push({
            id: `e-${depId}-${task.id}`,
            source: depId,
            target: task.id,
            type: 'smoothstep',
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'var(--app-text-subtle)',
            },
            style: {
              stroke: 'var(--app-text-subtle)',
              strokeWidth: 2,
              cursor: 'pointer',
            },
            animated: task.status === 'in_progress' || (sourceTask && sourceTask.status === 'in_progress')
          });
        });
      }
      
      if (task.parentId) {
         edges.push({
             id: `e-parent-${task.parentId}-${task.id}`,
             source: task.parentId,
             target: task.id,
             label: 'subtask',
             labelStyle: { fill: 'var(--app-text-muted)', fontSize: 10, fontWeight: 700 },
             labelBgStyle: { fill: 'var(--app-surface-dim)' },
             markerEnd: {
               type: MarkerType.ArrowClosed,
               color: 'var(--app-text-muted)',
             },
             style: {
               stroke: 'var(--app-text-muted)',
               strokeWidth: 1,
               strokeDasharray: '3 3',
             }
         });
      }
    });

    return getLayoutedElements(nodes, edges);
  }, [tasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const previousLayoutKey = React.useRef(layoutKey);

  // Update nodes and edges when tasks change
  React.useEffect(() => {
    const layoutKeyChanged = previousLayoutKey.current !== layoutKey;
    previousLayoutKey.current = layoutKey;

    setNodes((nds) => {
      if (layoutKeyChanged) {
        return initialNodes;
      }

      return initialNodes.map(inNode => {
        const existingNode = nds.find(n => n.id === inNode.id);
        if (existingNode) {
          return { ...inNode, position: existingNode.position };
        }
        return inNode;
      });
    });
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges, layoutKey]);

  const onConnect = useCallback((params: Connection) => {
    if (params.source && params.target && onConnectTask) {
      if (params.source !== params.target) {
        onConnectTask(params.source, params.target); // add edge dependency target -> source or source -> target?
        // if diagram connects dep -> task, then source is dep and target is task. target depends on source.
      }
    }
  }, [onConnectTask]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, node: any) => {
    const intersections = getIntersectingNodes(node).filter((n) => n.id !== node.id);
    if (intersections.length > 0 && onConnectTask) {
      const targetNode = intersections[0];
      // When dragging node A onto node B, make node A depend on node B
      onConnectTask(targetNode.id, node.id);
    }
  }, [getIntersectingNodes, onConnectTask]);

  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: any) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    clickTimeoutRef.current = setTimeout(() => {
      if (onReverseConnection) {
        if (edge.id.startsWith('e-parent-')) return;
        onReverseConnection(edge.source, edge.target);
      }
    }, 250);
  }, [onReverseConnection]);

  const onEdgeDoubleClick = useCallback((_: React.MouseEvent, edge: any) => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    if (onRemoveConnection) {
      if (edge.id.startsWith('e-parent-')) return;
      onRemoveConnection(edge.source, edge.target);
    }
  }, [onRemoveConnection]);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: any) => {
    if (onTaskDoubleClick) {
      onTaskDoubleClick(node.id);
    }
  }, [onTaskDoubleClick]);

  return (
    <div className="w-full h-full bg-surface-dim">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDoubleClick={onNodeDoubleClick}
        fitView
      >
        <Background gap={12} size={1} color="var(--app-border-strong)" />
        <Controls />
        <MiniMap 
          zoomable 
          pannable 
          nodeColor={(n: any) => n.data.borderColor} 
          maskColor="rgba(0, 0, 0, 0.4)" 
          style={{
            backgroundColor: 'var(--app-surface)',
            border: '1px solid var(--app-border-strong)',
            borderRadius: '8px',
            width: 250,
            height: 180,
            overflow: 'hidden'
          }}
        />
      </ReactFlow>
    </div>
  );
}

export default function TaskDiagram(props: TaskDiagramProps) {
  return (
    <ReactFlowProvider>
      <FlowLogic {...props} />
    </ReactFlowProvider>
  );
}
