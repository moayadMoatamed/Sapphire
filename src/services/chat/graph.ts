import { StateGraph } from '@langchain/langgraph'
import { ChatState } from './state'
import { recallNode } from './nodes/recall'
import { classifyIntentNode } from './nodes/classify-intent'
import { retrieveLowLevelNode } from './nodes/retrieve-low-level'
import { retrieveHighLevelNode } from './nodes/retrieve-high-level'
import { fuseContextNode } from './nodes/fuse-context'
import { generateNode } from './nodes/generate'
import { extractIdeasNode } from './nodes/extract-ideas'
import { updateMemoryNode } from './nodes/update-memory'
import { updateGraphNode } from './nodes/update-graph'

export function buildChatGraph() {
  const graph = new StateGraph(ChatState)
    .addNode('recall', recallNode)
    .addNode('classify_intent', classifyIntentNode)
    .addNode('retrieve_low_level', retrieveLowLevelNode)
    .addNode('retrieve_high_level', retrieveHighLevelNode)
    .addNode('fuse_context', fuseContextNode)
    .addNode('generate', generateNode)
    .addNode('extract_ideas', extractIdeasNode)
    .addNode('update_memory', updateMemoryNode)
    .addNode('update_graph', updateGraphNode)

  graph.addEdge('__start__', 'recall')
  graph.addEdge('recall', 'classify_intent')
  graph.addConditionalEdges('classify_intent', (state) => {
    if (state.intent?.intent === 'meta') return ['fuse_context']
    return ['retrieve_low_level', 'retrieve_high_level']
  })
  graph.addEdge('retrieve_low_level', 'fuse_context')
  graph.addEdge('retrieve_high_level', 'fuse_context')
  graph.addEdge('fuse_context', 'generate')
  graph.addEdge('generate', 'extract_ideas')
  graph.addEdge('extract_ideas', 'update_memory')
  graph.addEdge('update_memory', 'update_graph')
  graph.addEdge('update_graph', '__end__')

  return graph
}

export const chatGraph = buildChatGraph().compile()
