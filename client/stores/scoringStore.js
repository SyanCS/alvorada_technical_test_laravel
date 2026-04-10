import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useScoringStore = defineStore('scoring', () => {
    const results = ref([]);
    const requirements = ref('');
    const totalProperties = ref(0);
    const loading = ref(false);
    const error = ref(null);

    // Pipeline progress state
    const pipelineNodes = ref([]);
    const completedNodes = ref([]);
    const currentNode = ref(null);

    async function scoreProperties(requirementsText, limit = 10) {
        loading.value = true;
        error.value = null;
        results.value = [];
        requirements.value = requirementsText;
        pipelineNodes.value = [];
        completedNodes.value = [];
        currentNode.value = null;

        try {
            const response = await fetch('/api/ai/score/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'text/event-stream',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ requirements: requirementsText, limit }),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                let eventType = null;
                for (const line of lines) {
                    if (line.startsWith('event: ')) {
                        eventType = line.slice(7).trim();
                    } else if (line.startsWith('data: ') && eventType) {
                        const data = JSON.parse(line.slice(6));
                        handleSSE(eventType, data);
                        eventType = null;
                    }
                }
            }
        } catch (err) {
            error.value = err.message || 'Scoring failed';
            throw err;
        } finally {
            loading.value = false;
            currentNode.value = null;
        }
    }

    function handleSSE(event, data) {
        switch (event) {
            case 'nodes':
                pipelineNodes.value = data;
                if (data.length > 0) {
                    currentNode.value = data[0].id;
                }
                break;

            case 'node_complete':
                completedNodes.value.push(data.node);
                // Advance currentNode to the next incomplete node
                const nextNode = pipelineNodes.value.find(
                    (n) => !completedNodes.value.includes(n.id),
                );
                currentNode.value = nextNode?.id || null;
                break;

            case 'result': {
                const payload = data;
                results.value = payload.scored_properties ?? [];
                totalProperties.value = payload.total_properties ?? results.value.length;
                break;
            }

            case 'error':
                error.value = data.message || 'Unknown error';
                break;

            case 'done':
                break;
        }
    }

    function clearResults() {
        results.value = [];
        requirements.value = '';
        totalProperties.value = 0;
        error.value = null;
        pipelineNodes.value = [];
        completedNodes.value = [];
        currentNode.value = null;
    }

    return {
        results, requirements, totalProperties, loading, error,
        pipelineNodes, completedNodes, currentNode,
        scoreProperties, clearResults,
    };
});
